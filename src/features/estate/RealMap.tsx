import L from 'leaflet';
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { COMPANIES, SECTOR_LABEL, type CompanyDef } from '@/game/data/companies';
import { LANDS, type LandDef } from '@/game/data/lands';
import { hqLocation } from '@/game/engine/hq';
import { getLand } from '@/game/engine/land';
import { customLandId, customPrice, getCustom, quoteFeature } from '@/game/engine/systems/customEstate';
import { overpass, type BBox, type OsmFeature } from '@/game/services/osm/overpass';
import { PROPERTY_KIND as KIND_DEF } from '@/game/data/properties';
import { bumpGame, useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatMoney, formatNumber } from '@/utils/format';
import { sfx } from '@/utils/sfx';
import { BULK_BUY_LIMIT, levelOf } from '@/game/data/prestigeTree';

const Map3D = lazy(() => import('./Map3D').then((m) => ({ default: m.Map3D })));

/** ズームがこれ未満のときは都市ごとにまとめて表示する */
const CITY_ZOOM = 11;
/** このズーム以上で、実在の建物を読み込んで買えるようにする */
const BUILDING_ZOOM = 16;
/** このズーム以上で、立体表示（グーグルアース風）に切り替える */
const THREE_D_ZOOM = 16;

/**
 * 地図タイルは OpenStreetMap の標準タイル（API キー不要、日本語の地名）。
 * ダークテーマでは CSS フィルタ（components.css の `html[data-theme='dark'] .rm__map .leaflet-tile-pane`）で暗くする。
 * ※ CARTO の無料タイルは寄ると「API KEY REQUIRED」の透かしが入るため使わない。
 */
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

function companyIcon(owned: number, control: boolean, dissolved: boolean): L.DivIcon {
  const cls = ['rm-hq', control ? 'rm-hq--control' : owned > 0 ? 'rm-hq--owned' : '', dissolved ? 'rm-hq--dissolved' : ''].filter(Boolean).join(' ');
  // 物件のピンと重ならないよう、本社は少し右上に浮かせる
  return L.divIcon({ className: 'rm-icon', html: `<span class="${cls}">株</span>`, iconSize: [26, 26], iconAnchor: [-2, 28] });
}

function landIcon(owned: boolean): L.DivIcon {
  return L.divIcon({ className: 'rm-icon', html: `<span class="rm-land${owned ? ' rm-land--owned' : ''}">▲</span>`, iconSize: [26, 26], iconAnchor: [28, -2] });
}

/**
 * 実在の地図（OpenStreetMap のタイル）の上に、物件・会社の本社・産業用地を置く。
 * ズームアウト時は都市ごとにまとめ、タップでその都市へ寄る。
 */
export function RealMap() {
  const { state, derived, engine } = useGame();
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
  const [features, setFeatures] = useState<OsmFeature[]>([]);
  const [osmState, setOsmState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [osmError, setOsmError] = useState<string | null>(null);
  const [bounds, setBounds] = useState<BBox | null>(null);
  const [view, setView] = useState<{ lat: number; lon: number; zoom: number }>({ lat: 36.5, lon: 138.5, zoom: 5 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const [threeDError, setThreeDError] = useState<string | null>(null);
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);
  const bulkLevel = levelOf(state.prestige?.upgrades, 'bulk_buy');
  const openFeature = useUiStore((s) => s.openFeature);
  const buildingLayerRef = useRef<L.LayerGroup | null>(null);
  const buildingRendererRef = useRef<L.Canvas | null>(null);

  // 地図の作成（1回だけ）
  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;
    const start = useUiStore.getState().mapTarget;
    const last = viewRef.current;
    const from = start ?? (last.zoom > 5 ? last : null);
    const map = L.map(el, {
      center: from ? [from.lat, from.lon] : [36.5, 138.5],
      zoom: from ? from.zoom : 5,
      zoomControl: true,
      attributionControl: true,
      worldCopyJump: true,
      minZoom: 2,
      maxZoom: 19,
    });
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    buildingRendererRef.current = L.canvas({ padding: 0.3 });
    buildingLayerRef.current = L.layerGroup().addTo(map);
    const syncBounds = () => {
      const b = map.getBounds();
      const c = map.getCenter();
      setBounds({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() });
      setView({ lat: c.lat, lon: c.lng, zoom: map.getZoom() });
    };
    map.on('moveend', syncBounds);
    map.on('zoomend', () => {
      setZoom(map.getZoom());
      syncBounds();
    });
    syncBounds();
    setZoom(map.getZoom());
    setReady(true);
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      buildingLayerRef.current = null;
      tileRef.current = null;
    };
  }, []);

  // タイル（テーマによる見た目の違いは CSS フィルタで付けるので、レイヤーは1つ）
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (tileRef.current) tileRef.current.remove();
    setTileError(false);
    const tile = L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 19, crossOrigin: true });
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
  }, [ready]);

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
  const holdingsKey = Object.entries(state.stocks.companies)
    .map(([id, s]) => `${id}:${s.playerShares > 0 ? (derived.companies[id]?.ownership ?? 0) >= 2 / 3 ? 'c' : 'o' : ''}${s.dissolved ? 'x' : ''}`)
    .join(',');
  const landsKey = state.lands.map((l) => l.id).join(',');
  const customKeyForMarkers = Object.keys(state.estate.custom ?? {}).sort().join(',');
  const hqKey = `${state.settings.hqLocation?.lat ?? ''},${state.settings.hqLocation?.lon ?? ''}`;
  const builtKey = state.facilities.map((f) => `${f.landId}:${f.count}`).sort().join(',');
  const priceKey = Object.values(state.estate.cityMult)
    .map((m) => m.toFixed(2))
    .join(',');

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const mode = state.settings.numberFormat;

    // 会社の本社（寄ったときだけ）
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
    // 前のバージョンで買った産業用地（持っているものだけ出す）
    for (const l of LANDS as readonly LandDef[]) {
      if (!getLand(state, l.id)) continue;
      const built = state.facilities.filter((f) => f.landId === l.id).reduce((a, f) => a + f.count, 0);
      const m = L.marker([l.lat, l.lon], { icon: landIcon(true), title: l.name, zIndexOffset: 50 });
      m.bindTooltip(`${l.name}（所有）<br>施設 ${formatNumber(built, mode)}`, { direction: 'top', offset: [0, -12] });
      m.on('click', () => openLand(l.id));
      m.addTo(layer);
    }
    // 地図で買った実在の場所（寄っていなくても場所が分かるように小さなピンを置く）
    for (const cp of Object.values(state.estate.custom ?? {})) {
      if (zoom < CITY_ZOOM) break;
      const m = L.marker([cp.lat, cp.lon], {
        icon: L.divIcon({ className: 'rm-icon', html: `<span class="rm-pin rm-pin--player" style="--pin:${KIND_DEF[cp.kind].color}"></span>`, iconSize: [26, 26], iconAnchor: [13, 13] }),
        title: cp.name,
        zIndexOffset: 80,
      });
      const built = state.facilities.filter((x) => x.landId === customLandId(cp.id)).reduce((a, x) => a + x.count, 0);
      m.bindTooltip(`${cp.name}（${cp.label}）<br>所有中・${formatMoney(customPrice(state, cp), mode)}<br>施設 ${built}`, { direction: 'top', offset: [0, -12] });
      m.on('click', () =>
        openFeature({
          id: cp.id,
          kind: cp.kind,
          label: cp.label,
          name: cp.name,
          named: false,
          lat: cp.lat,
          lon: cp.lon,
          areaSqm: cp.areaSqm,
          levels: cp.levels,
          polygon: [],
        }),
      );
      m.addTo(layer);
    }
    const hqAt = hqLocation(state);
    const hq = L.marker([hqAt.lat, hqAt.lon], { icon: L.divIcon({ className: 'rm-icon', html: '<span class="rm-hqself">本社</span>', iconSize: [40, 22], iconAnchor: [20, 11] }), zIndexOffset: 200 });
    hq.bindTooltip(`本社（${hqAt.label}）`, { direction: 'top', offset: [0, -10] });
    hq.on('click', () => openLand('hq'));
    hq.addTo(layer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, ownedKey, companyOwnedKey, holdingsKey, landsKey, builtKey, priceKey, customKeyForMarkers, hqKey, ready, state.settings.numberFormat]);

  // --- 実在の建物（OpenStreetMap）: 寄ったときだけ読み込む ---
  const customKey = Object.keys(state.estate.custom ?? {}).sort().join(',');
  const numberFormat = state.settings.numberFormat;
  // 3D に渡す配列は、持ち物が変わったときだけ作り直す（毎回作ると 3D が作り直される）
  const ownedIds = useMemo(() => (customKey ? customKey.split(',') : []), [customKey]);
  const use3DRef = useRef(false);

  useEffect(() => {
    if (!ready || !bounds) return;
    if (zoom < BUILDING_ZOOM) {
      setFeatures([]);
      setBulkMsg(null);
      setOsmState('idle');
      setOsmError(null);
      return;
    }
    let cancelled = false;
    const cachedNow = overpass.cached(bounds);
    if (cachedNow) {
      setFeatures(cachedNow);
      setBulkMsg(null);
      setOsmState('idle');
      return;
    }
    setOsmState('loading');
    const t = setTimeout(() => {
      void overpass.load(bounds).then((r) => {
        if (cancelled) return;
        setFeatures(r.features);
        setBulkMsg(null);
        setOsmState(r.error ? 'error' : 'idle');
        setOsmError(r.error ?? null);
      });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [ready, zoom, bounds]);

  // 建物の描画
  useEffect(() => {
    const layer = buildingLayerRef.current;
    if (!layer) return;
    const mode = state.settings.numberFormat;
    layer.clearLayers();
    if (zoom < BUILDING_ZOOM) return;
    // 大きい区画を先に描いて、小さな建物が上に来るようにする（タップしやすさ）
    const ordered = [...features].sort((a, b) => b.areaSqm - a.areaSqm);
    const heavy = ordered.length > 300;
    for (const f of ordered) {
      const owned = getCustom(state, f.id);
      const color = KIND_DEF[owned?.kind ?? f.kind].color;
      const poly = L.polygon(
        f.polygon.map((p) => [p.lat, p.lon] as [number, number]),
        {
          color,
          weight: owned ? 3 : 1.5,
          opacity: owned ? 1 : 0.8,
          fillColor: color,
          fillOpacity: owned ? 0.55 : 0.18,
          className: 'rm-osm',
          // 数が多いときは Canvas で描く（SVG だと重くなるため）
          renderer: heavy ? (buildingRendererRef.current ?? undefined) : undefined,
        },
      );
      const price = owned ? customPrice(state, owned) : quoteFeature(f).basePrice;
      const built = owned ? state.facilities.filter((x) => x.landId === customLandId(f.id)).reduce((a, x) => a + x.count, 0) : 0;
      poly.bindTooltip(
        `${owned?.name ?? f.name}<br>${owned?.label ?? f.label}・${Math.round(f.areaSqm).toLocaleString('ja-JP')}㎡<br>${owned ? `所有中・施設 ${built}` : formatMoney(price, mode)}`,
        { direction: 'top', sticky: true },
      );
      poly.on('click', () => openFeature(f));
      poly.addTo(layer);
    }
  }, [features, zoom, customKey, numberFormat]);

  // 3D から 2D に戻ったら、隠れていたあいだに変わった大きさを地図に教える
  useEffect(() => {
    if (use3DRef.current && !use3D) {
      setTimeout(() => mapRef.current?.invalidateSize(), 60);
    }
    use3DRef.current = use3D;
  });

  // 既定は平面。近づいたときだけ「3D」ボタンが出て、押した人だけ立体になる
  const canUse3D = view.zoom >= THREE_D_ZOOM;
  const wants3D = state.settings.map3D === true;
  const use3D = wants3D && !threeDError && canUse3D;

  const goJapan = () => mapRef.current?.flyTo([36.5, 137], 5, { duration: 0.6 });
  const goWorld = () => mapRef.current?.setView([20, 10], 2);
  const ownedPoints: [number, number][] = [
    ...Object.values(state.estate.custom ?? {}).map((cp) => [cp.lat, cp.lon] as [number, number]),
    ...(LANDS as readonly LandDef[]).filter((l) => getLand(state, l.id)).map((l) => [l.lat, l.lon] as [number, number]),
  ];
  const goOwned = () => {
    const map = mapRef.current;
    if (!map || ownedPoints.length === 0) return;
    if (ownedPoints.length === 1) {
      map.flyTo(ownedPoints[0], 17, { duration: 0.8 });
      return;
    }
    map.fitBounds(L.latLngBounds(ownedPoints).pad(0.3), { maxZoom: 15 });
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
          <Button size="sm" disabled={ownedPoints.length === 0} onClick={goOwned}>
            所有地へ
          </Button>
          {bulkLevel > 0 && features.length > 0 && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                const r = engine.bulkBuyFeatures(features);
                setBulkMsg(r.reason ?? `${r.bought}件を買いました`);
                if (r.bought > 0) sfx('buy');
                bumpGame();
              }}
              title="いま地図に出ている物件を、安いものから所持金の半分までまとめて買います"
            >
              表示中を一括買収（最大{BULK_BUY_LIMIT[Math.min(bulkLevel, BULK_BUY_LIMIT.length) - 1]}件）
            </Button>
          )}
          {canUse3D && (
            <Button
              size="sm"
              variant={use3D ? 'primary' : 'secondary'}
              onClick={() => {
                setThreeDError(null);
                engine.updateSettings({ map3D: !wants3D });
                bumpGame();
              }}
              title="近づいた場所を立体で表示します"
            >
              {use3D ? '2Dに戻す' : '3Dで見る'}
            </Button>
          )}
        </div>
        <span className="text-sub" style={{ fontSize: 11 }}>
          {bulkMsg
            ? bulkMsg
            : zoom < CITY_ZOOM
            ? '丸は物件のある都市。タップで寄る。▲は施設を建てられる産業用地（タップで購入）'
            : zoom < BUILDING_ZOOM
              ? 'ピンをタップで詳細。もう少し寄ると、実在の建物を買えるようになります'
              : osmState === 'loading'
                ? 'この辺りの建物を読み込み中…'
                : osmState === 'error'
                  ? `建物を読み込めませんでした（${osmError ?? '通信エラー'}）。少し待つか、地図を動かすと再試行します`
                  : '建物や区画をタップすると買えます'}
        </span>
      </div>
      <div className="rm__stage">
        {use3D ? (
          <Suspense
            fallback={
              <div className="rm__map rm__map--loading" role="status">
                立体表示を読み込み中…
              </div>
            }
          >
            <Map3D
              center={view}
              features={features}
              ownedIds={ownedIds}
              onSelect={(f) => openFeature(f)}
              onView={(v) => {
                setView({ lat: v.lat, lon: v.lon, zoom: v.zoom });
                setBounds(v.bounds);
              }}
              onError={(m) => setThreeDError(m)}
            />
          </Suspense>
        ) : null}
        {/* 2D の入れ物は外さない。外すと 3D から戻ったときに地図が作り直されず真っ白になる */}
        <div
          ref={containerRef}
          className="rm__map"
          role="application"
          aria-label="実在の地図"
          style={{ display: use3D ? 'none' : 'block' }}
        />
        {!use3D && tileError && (
          <div className="rm__notice" role="status">
            地図の画像を読み込めません（オフラインかブロックされています）。ピンは表示されるので、そのまま使えます。
          </div>
        )}
        {threeDError && view.zoom >= THREE_D_ZOOM && (
          <div className="rm__notice" role="status">
            立体表示を使えませんでした（{threeDError}）。平面の地図で続けます。
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
        <span className="rm__legend-item">
          <span className="rm-osm-legend" />
          実在の建物（拡大すると出る）
        </span>
      </div>
      <p className="text-dim" style={{ fontSize: 11 }}>
        地図・建物のデータ: © OpenStreetMap contributors（ODbL）。名前は実在の施設をもじった架空のもので、価格は公示地価などを参考にしたゲーム用の値です。会社はすべて架空です。
      </p>
    </div>
  );
}
