import L from 'leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { CITIES, type CityDef } from '@/game/data/cities';
import { COMPANIES, COMPANY_MAP, SECTOR_LABEL, type CompanyDef } from '@/game/data/companies';
import { HQ_LOCATION, LANDS, type LandDef } from '@/game/data/lands';
import { PROPERTIES, PROPERTY_KIND, type PropertyDef } from '@/game/data/properties';
import { getLand } from '@/game/engine/land';
import { propertyBuyCost, propertyOwner, propertyPrice } from '@/game/engine/systems/estate';
import { isUnlocked } from '@/game/engine/systems/unlocks';
import { useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatMoney } from '@/utils/format';
import { useResolvedTheme } from '@/utils/theme';

/** ズームがこれ未満のときは都市ごとにまとめて表示する */
const CITY_ZOOM = 11;

const TILES = {
  light: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
};
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>';

type Owner = 'player' | 'company' | 'market';

function propertyIcon(def: PropertyDef, owner: Owner, affordable: boolean): L.DivIcon {
  const color = PROPERTY_KIND[def.kind].color;
  const cls = ['rm-pin', `rm-pin--${owner}`, affordable && owner === 'market' ? 'rm-pin--affordable' : ''].filter(Boolean).join(' ');
  return L.divIcon({ className: 'rm-icon', html: `<span class="${cls}" style="--pin:${color}"></span>`, iconSize: [26, 26], iconAnchor: [13, 13] });
}

function companyIcon(owned: number, control: boolean, dissolved: boolean): L.DivIcon {
  const cls = ['rm-hq', control ? 'rm-hq--control' : owned > 0 ? 'rm-hq--owned' : '', dissolved ? 'rm-hq--dissolved' : ''].filter(Boolean).join(' ');
  // 物件のピンと重ならないよう、本社は少し右上に浮かせる
  return L.divIcon({ className: 'rm-icon', html: `<span class="${cls}">株</span>`, iconSize: [26, 26], iconAnchor: [-2, 28] });
}

function landIcon(owned: boolean): L.DivIcon {
  return L.divIcon({ className: 'rm-icon', html: `<span class="rm-land${owned ? ' rm-land--owned' : ''}">▲</span>`, iconSize: [26, 26], iconAnchor: [28, -2] });
}

function cityIcon(count: number, owned: number, affordable: number): L.DivIcon {
  const cls = ['rm-city', owned > 0 ? 'rm-city--owned' : '', affordable > 0 ? 'rm-city--affordable' : ''].filter(Boolean).join(' ');
  return L.divIcon({ className: 'rm-icon', html: `<span class="${cls}">${count}</span>`, iconSize: [30, 30], iconAnchor: [15, 15] });
}

/**
 * 実在の地図（OpenStreetMap / CARTO のタイル）の上に、物件・会社の本社・産業用地を置く。
 * ズームアウト時は都市ごとにまとめ、タップでその都市へ寄る。
 */
export function RealMap() {
  const { state, derived } = useGame();
  const theme = useResolvedTheme();
  const openProperty = useUiStore((s) => s.openProperty);
  const openCompany = useUiStore((s) => s.openCompany);
  const openLand = useUiStore((s) => s.openLand);
  const mapTarget = useUiStore((s) => s.mapTarget);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const [zoom, setZoom] = useState(4);
  const [tileError, setTileError] = useState(false);
  const [ready, setReady] = useState(false);

  // 地図の作成（1回だけ）
  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;
    const map = L.map(el, { center: [36.5, 138.5], zoom: 5, zoomControl: true, attributionControl: true, worldCopyJump: true, minZoom: 2, maxZoom: 17 });
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    map.on('zoomend', () => setZoom(map.getZoom()));
    setZoom(map.getZoom());
    setReady(true);
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      tileRef.current = null;
    };
  }, []);

  // タイル（テーマで切替）
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (tileRef.current) tileRef.current.remove();
    setTileError(false);
    const tile = L.tileLayer(TILES[theme], { attribution: ATTRIBUTION, subdomains: 'abcd', maxZoom: 19, crossOrigin: true });
    let errors = 0;
    tile.on('tileerror', () => {
      errors += 1;
      if (errors >= 4) setTileError(true);
    });
    tile.on('tileload', () => {
      errors = 0;
      setTileError(false);
    });
    tile.addTo(map);
    tileRef.current = tile;
  }, [theme, ready]);

  // 外から指定された場所へ移動
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapTarget) return;
    map.flyTo([mapTarget.lat, mapTarget.lon], mapTarget.zoom, { duration: 0.8 });
  }, [mapTarget]);

  // マーカーの内容を決める要素。変わったときだけ描き直す
  const ownedKey = Object.keys(state.estate.owned).sort().join(',');
  const companyOwnedKey = Object.entries(state.estate.companyOwned)
    .map(([p, c]) => `${p}:${c}`)
    .sort()
    .join(',');
  const affordableKey = (PROPERTIES as readonly PropertyDef[])
    .filter((p) => state.company.cash >= propertyBuyCost(state, p.id))
    .map((p) => p.id)
    .join(',');
  const holdingsKey = Object.entries(state.stocks.companies)
    .map(([id, s]) => `${id}:${s.playerShares > 0 ? (derived.companies[id]?.ownership ?? 0) >= 2 / 3 ? 'c' : 'o' : ''}${s.dissolved ? 'x' : ''}`)
    .join(',');
  const landsKey = state.lands.map((l) => l.id).join(',');
  const priceKey = Object.values(state.estate.cityMult)
    .map((m) => m.toFixed(2))
    .join(',');

  const cities = useMemo(() => {
    const byCity = new Map<string, PropertyDef[]>();
    for (const p of PROPERTIES as readonly PropertyDef[]) {
      const arr = byCity.get(p.city) ?? [];
      arr.push(p);
      byCity.set(p.city, arr);
    }
    return byCity;
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const affordable = new Set(affordableKey.split(',').filter(Boolean));
    const mode = state.settings.numberFormat;

    if (zoom < CITY_ZOOM) {
      // 近い都市（画面上で重なる）はまとめる
      type Group = { cities: CityDef[]; props: PropertyDef[]; x: number; y: number };
      const groups: Group[] = [];
      for (const c of CITIES as readonly CityDef[]) {
        const props = cities.get(c.id) ?? [];
        if (props.length === 0) continue;
        const pt = map.project([c.lat, c.lon], zoom);
        const g = groups.find((gr) => Math.hypot(gr.x - pt.x, gr.y - pt.y) < 40);
        if (g) {
          g.cities.push(c);
          g.props.push(...props);
        } else {
          groups.push({ cities: [c], props: [...props], x: pt.x, y: pt.y });
        }
      }
      for (const g of groups) {
        const lat = g.cities.reduce((a, c) => a + c.lat, 0) / g.cities.length;
        const lon = g.cities.reduce((a, c) => a + c.lon, 0) / g.cities.length;
        const owned = g.props.filter((p) => propertyOwner(state, p.id).type === 'player').length;
        const buyable = g.props.filter((p) => affordable.has(p.id) && propertyOwner(state, p.id).type === 'market').length;
        const names = g.cities.map((c) => c.name).join('・');
        const m = L.marker([lat, lon], { icon: cityIcon(g.props.length, owned, buyable), title: names, zIndexOffset: 1000 });
        m.bindTooltip(`${names}（物件 ${g.props.length}件${owned > 0 ? `・所有 ${owned}` : ''}${buyable > 0 ? `・買える ${buyable}` : ''}）`, { direction: 'top', offset: [0, -12] });
        m.on('click', () => {
          if (g.cities.length === 1) map.flyTo([g.cities[0].lat, g.cities[0].lon], 13, { duration: 0.7 });
          else map.flyToBounds(L.latLngBounds(g.cities.map((c) => [c.lat, c.lon] as [number, number])).pad(0.4), { duration: 0.7, maxZoom: 13 });
        });
        m.addTo(layer);
      }
    } else {
      for (const p of PROPERTIES as readonly PropertyDef[]) {
        const owner = propertyOwner(state, p.id).type;
        const m = L.marker([p.lat, p.lon], { icon: propertyIcon(p, owner, affordable.has(p.id)), title: p.name });
        const price = formatMoney(propertyPrice(state, p.id), mode);
        const status = owner === 'player' ? '所有中' : owner === 'company' ? `${COMPANY_MAP[state.estate.companyOwned[p.id] as keyof typeof COMPANY_MAP]?.name ?? '他社'}が所有` : affordable.has(p.id) ? '購入できる' : '資金不足';
        m.bindTooltip(`${p.name}<br>${PROPERTY_KIND[p.kind].label}・${price}・${status}`, { direction: 'top', offset: [0, -12] });
        m.on('click', () => openProperty(p.id));
        m.addTo(layer);
      }
    }
    // 会社の本社（寄ったときだけ。遠いときは都市のまとまりに含める）
    for (const c of COMPANIES as readonly CompanyDef[]) {
      if (zoom < CITY_ZOOM) break;
      const s = state.stocks.companies[c.id];
      const rt = derived.companies[c.id];
      const control = (rt?.ownership ?? 0) + 1e-9 >= 2 / 3;
      const m = L.marker([c.lat, c.lon], { icon: companyIcon(s?.playerShares ?? 0, control, s?.dissolved ?? false), title: c.name, zIndexOffset: 100 });
      const price = rt ? formatMoney(rt.price, mode) : '-';
      m.bindTooltip(`${c.name}（${SECTOR_LABEL[c.sector].label}）<br>株価 ${price}${s?.dissolved ? '・解体済み' : rt && rt.ownership > 0 ? `・持株 ${(rt.ownership * 100).toFixed(1)}%` : ''}`, { direction: 'top', offset: [0, -12] });
      m.on('click', () => openCompany(c.id));
      m.addTo(layer);
    }
    // 産業用地（LAND 画面の土地）と本社
    for (const l of LANDS as readonly LandDef[]) {
      if (zoom < CITY_ZOOM) break;
      if (!isUnlocked(state, 'land', l.id) && !getLand(state, l.id)) continue;
      const owned = !!getLand(state, l.id);
      const m = L.marker([l.lat, l.lon], { icon: landIcon(owned), title: l.name, zIndexOffset: 50 });
      m.bindTooltip(`${l.name}（産業用地${owned ? '・所有' : `・${formatMoney(l.price, mode)}`}）`, { direction: 'top', offset: [0, -12] });
      m.on('click', () => openLand(l.id));
      m.addTo(layer);
    }
    const hq = L.marker([HQ_LOCATION.lat, HQ_LOCATION.lon], { icon: L.divIcon({ className: 'rm-icon', html: '<span class="rm-hqself">本社</span>', iconSize: [40, 22], iconAnchor: [20, 11] }), zIndexOffset: 200 });
    hq.bindTooltip('本社（大阪）', { direction: 'top', offset: [0, -10] });
    hq.on('click', () => openLand('hq'));
    hq.addTo(layer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, ownedKey, companyOwnedKey, affordableKey, holdingsKey, landsKey, priceKey, ready, state.settings.numberFormat]);

  const ownedProps = Object.keys(state.estate.owned);
  const goJapan = () => mapRef.current?.flyTo([36.5, 137], 5, { duration: 0.6 });
  const goWorld = () => mapRef.current?.setView([20, 10], 2);
  const goOwned = () => {
    const map = mapRef.current;
    if (!map || ownedProps.length === 0) return;
    const pts = ownedProps.map((id) => {
      const p = PROPERTIES.find((q) => q.id === id)!;
      return [p.lat, p.lon] as [number, number];
    });
    map.fitBounds(L.latLngBounds(pts).pad(0.3), { maxZoom: 12 });
  };

  return (
    <div className="rm">
      <div className="rm__toolbar">
        <div className="btn-row">
          <Button size="sm" onClick={goJapan}>
            日本
          </Button>
          <Button size="sm" onClick={goWorld}>
            世界
          </Button>
          <Button size="sm" disabled={ownedProps.length === 0} onClick={goOwned}>
            所有物件へ
          </Button>
        </div>
        <span className="text-sub" style={{ fontSize: 11 }}>
          {zoom < CITY_ZOOM ? '数字は都市の物件数。タップで寄る（会社の本社と産業用地は寄ると出ます）' : 'ピンをタップで詳細'}
        </span>
      </div>
      <div className="rm__stage">
        <div ref={containerRef} className="rm__map" role="application" aria-label="実在の地図" />
        {tileError && (
          <div className="rm__notice" role="status">
            地図の画像を読み込めません（オフラインかブロックされています）。ピンは表示されるので、そのまま使えます。
          </div>
        )}
      </div>
      <div className="rm__legend">
        <span className="rm__legend-item">
          <span className="rm-pin rm-pin--market rm-pin--affordable" style={{ ['--pin' as string]: '#5ea7ff' }} />
          買える物件
        </span>
        <span className="rm__legend-item">
          <span className="rm-pin rm-pin--market" style={{ ['--pin' as string]: '#5ea7ff' }} />
          資金不足
        </span>
        <span className="rm__legend-item">
          <span className="rm-pin rm-pin--player" style={{ ['--pin' as string]: '#5ea7ff' }} />
          所有中
        </span>
        <span className="rm__legend-item">
          <span className="rm-pin rm-pin--company" style={{ ['--pin' as string]: '#5ea7ff' }} />
          他社所有
        </span>
        <span className="rm__legend-item">
          <span className="rm-hq">株</span>
          会社の本社
        </span>
        <span className="rm__legend-item">
          <span className="rm-land">▲</span>
          産業用地
        </span>
      </div>
      <p className="text-dim" style={{ fontSize: 11 }}>
        地図: © OpenStreetMap contributors, © CARTO。物件・会社は架空で、価格は公示地価などを参考にしたゲーム用の値です。色は種類（{Object.values(PROPERTY_KIND).map((k) => k.label).join('・')}）。
      </p>
    </div>
  );
}
