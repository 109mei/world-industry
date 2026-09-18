import L from 'leaflet';
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { COMPANIES, SECTOR_LABEL, type CompanyDef } from '@/game/data/companies';
import { LANDS, type LandDef } from '@/game/data/lands';
import { hqLocation } from '@/game/engine/hq';
import { COUNTRY_MAP, SHIP_MODE_MAP, type ShipMode } from '@/game/data/trade';
import { RESOURCE_MAP, type ResourceId } from '@/game/data/resources';
import { getLand } from '@/game/engine/land';
import { customLandId, customPrice, getCustom, plotFeatureAt, quoteAny } from '@/game/engine/systems/customEstate';
import { cellPolygon, parsePlotId, PLOT_SIZES, PLOT_SIZE_MAP } from '@/game/data/plots';
import { overpass, type BBox, type OsmFeature } from '@/game/services/osm/overpass';
import { PROPERTY_KIND as KIND_DEF } from '@/game/data/properties';
import { bumpGame, useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatMoney, formatNumber } from '@/utils/format';
import { formatQty } from '@/utils/names';
import { sfx } from '@/utils/sfx';
import { distanceKm, formatDistance, polygonCenter } from '@/utils/geo';
import { isLandSystemUnlocked, isUnlocked } from '@/game/engine/systems/unlocks';
import { BULK_BUY_LIMIT, levelOf } from '@/game/data/prestigeTree';

const Map3D = lazy(() => import('./Map3D').then((m) => ({ default: m.Map3D })));

/**
 * 「本社から半径○km」の選択肢。
 * 近所を探すとき（徒歩・車で行ける範囲）から、県内・全国まで一息に切り替えられるようにする。
 */
const RADIUS_OPTIONS: { km: number | null; label: string }[] = [
  { km: null, label: '制限なし' },
  { km: 1, label: '1km' },
  { km: 5, label: '5km' },
  { km: 10, label: '10km' },
  { km: 50, label: '50km' },
  { km: 100, label: '100km' },
  { km: 500, label: '500km' },
];

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
  const radiusKm = useUiStore((s) => s.mapRadiusKm);
  const setRadiusKm = useUiStore((s) => s.setMapRadiusKm);
  const radiusFrom = useUiStore((s) => s.mapRadiusFrom);
  const setRadiusFrom = useUiStore((s) => s.setMapRadiusFrom);
  const plotSize = useUiStore((s) => s.mapPlotSize);
  const setPlotSize = useUiStore((s) => s.setMapPlotSize);
  const selectedFeature = useUiStore((s) => s.selectedFeature);
  const buildingLayerRef = useRef<L.LayerGroup | null>(null);
  const plotLayerRef = useRef<L.LayerGroup | null>(null);
  /** 建物を押したときに、その下の地面まで拾ってしまわないための目印 */
  const layerClickAtRef = useRef(0);
  const radiusLayerRef = useRef<L.LayerGroup | null>(null);
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
      // 地球の反対側まで荷を運ぶので、世界全体が1画面に入るところまで引けるようにする
      minZoom: 1,
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
    /*
     * 何も無いところを押したら、その足もとの区画を売り出す。
     * 建物を押したときは、その建物のほうを開きたいので少しのあいだ無視する
     * （Leaflet は地面と重なった図形の両方に click を流すことがある）。
     */
    map.on('click', (ev: L.LeafletMouseEvent) => {
      if (Date.now() - layerClickAtRef.current < 80) return;
      const size = useUiStore.getState().mapPlotSize;
      if (map.getZoom() < PLOT_SIZE_MAP[size].minZoom) return;
      useUiStore.getState().openFeature(plotFeatureAt({ lat: ev.latlng.lat, lon: ev.latlng.lng }, size));
    });
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

  // --- 「本社から半径○km」の絞り込み ---
  // 中心は本社か、いま見ている地図の真ん中。どちらも数値2つに落としてから使う
  // （オブジェクトのまま useEffect の依存に入れると、毎回作り直されて描画が走ってしまう）
  const hqPoint = hqLocation(state);
  const centerLat = radiusFrom === 'view' ? view.lat : hqPoint.lat;
  const centerLon = radiusFrom === 'view' ? view.lon : hqPoint.lon;
  const landSystemOpen = isLandSystemUnlocked(state, derived.assets);

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
  const markKey = (state.bookmarks ?? []).map((b) => `${b.kind}:${b.id}`).join(',');
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
    const withinRadius = (pt: { lat: number; lon: number }) => radiusKm == null || distanceKm({ lat: centerLat, lon: centerLon }, pt) <= radiusKm;

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
    // 産業用地。持っているものと、いま買えるものの両方を出す
    // （買えるものを出さないと、用意された土地にたどり着く道が地図の上に無くなってしまう）
    const hqHere = hqLocation(state);
    for (const l of LANDS as readonly LandDef[]) {
      const owned = !!getLand(state, l.id);
      if (!owned) {
        if (!landSystemOpen || !isUnlocked(state, 'land', l.id)) continue;
        if (!withinRadius(l)) continue;
      }
      const built = owned ? state.facilities.filter((f) => f.landId === l.id).reduce((a, f) => a + f.count, 0) : 0;
      const m = L.marker([l.lat, l.lon], { icon: landIcon(owned), title: l.name, zIndexOffset: 50 });
      m.bindTooltip(
        owned
          ? `${l.name}（所有）<br>施設 ${formatNumber(built, mode)}`
          : `${l.name}<br>${formatMoney(l.price, mode)}・${Math.round(l.areaSqm).toLocaleString('ja-JP')}㎡<br>本社から ${formatDistance(distanceKm(hqHere, l))}`,
        { direction: 'top', offset: [0, -12] },
      );
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
      m.on('click', () => {
        layerClickAtRef.current = Date.now();
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
        });
      });
      m.addTo(layer);
    }
    // 印を付けた場所（★）。どこに目を付けていたかを地図の上でも分かるようにする
    for (const b of state.bookmarks ?? []) {
      if (zoom < CITY_ZOOM) break;
      const m = L.marker([b.lat, b.lon], {
        icon: L.divIcon({ className: 'rm-icon', html: '<span class="rm-mark">★</span>', iconSize: [22, 22], iconAnchor: [11, 22] }),
        title: b.label,
        zIndexOffset: 150,
      });
      m.bindTooltip(`★ ${b.label}${b.note ? `<br>${b.note}` : ''}`, { direction: 'top', offset: [0, -14] });
      m.addTo(layer);
    }

    const hqAt = hqLocation(state);
    const hq = L.marker([hqAt.lat, hqAt.lon], { icon: L.divIcon({ className: 'rm-icon', html: '<span class="rm-hqself">本社</span>', iconSize: [40, 22], iconAnchor: [20, 11] }), zIndexOffset: 200 });
    hq.bindTooltip(`本社（${hqAt.label}）`, { direction: 'top', offset: [0, -10] });
    hq.on('click', () => openLand('hq'));
    hq.addTo(layer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, ownedKey, companyOwnedKey, holdingsKey, landsKey, builtKey, priceKey, customKeyForMarkers, hqKey, ready, state.settings.numberFormat, radiusKm, centerLat, centerLon, landSystemOpen, markKey]);

  /*
   * 区画の輪郭。
   * ピンだけだと「どこからどこまで買ったのか」が分からないので、
   * 持っている区画は塗り、いま選んでいる区画は点線で囲って広さを見せる。
   */
  const ownedPlotsKey = Object.keys(state.estate.custom ?? {}).filter((id) => parsePlotId(id)).sort().join(',');
  const selectedPlotId = selectedFeature && parsePlotId(selectedFeature.id) ? selectedFeature.id : null;
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!plotLayerRef.current) plotLayerRef.current = L.layerGroup().addTo(map);
    const layer = plotLayerRef.current;
    layer.clearLayers();
    if (zoom < CITY_ZOOM) return;
    const draw = (id: string, owned: boolean) => {
      const cell = parsePlotId(id);
      if (!cell) return;
      L.polygon(
        cellPolygon(cell).map((pt) => [pt.lat, pt.lon] as [number, number]),
        owned
          ? { color: '#8fbf6a', weight: 2, opacity: 0.95, fillColor: '#8fbf6a', fillOpacity: 0.22, interactive: false }
          : { color: '#5EA7FF', weight: 2, opacity: 0.95, dashArray: '6 5', fillColor: '#5EA7FF', fillOpacity: 0.12, interactive: false },
      ).addTo(layer);
    };
    for (const id of ownedPlotsKey ? ownedPlotsKey.split(',') : []) draw(id, true);
    if (selectedPlotId && !ownedPlotsKey.split(',').includes(selectedPlotId)) draw(selectedPlotId, false);
  }, [ownedPlotsKey, selectedPlotId, zoom, ready]);

  // --- 半径の円（絞り込んでいる範囲を目で見えるようにする） ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!radiusLayerRef.current) radiusLayerRef.current = L.layerGroup().addTo(map);
    const layer = radiusLayerRef.current;
    layer.clearLayers();
    if (radiusKm == null) return;
    L.circle([centerLat, centerLon], {
      radius: radiusKm * 1000,
      color: '#5EA7FF',
      weight: 2,
      opacity: 0.8,
      dashArray: '6 6',
      fillColor: '#5EA7FF',
      fillOpacity: 0.05,
      interactive: false,
    }).addTo(layer);
    L.circleMarker([centerLat, centerLon], { radius: 4, color: '#5EA7FF', weight: 2, fillOpacity: 1, interactive: false }).addTo(layer);
  }, [radiusKm, centerLat, centerLon, ready]);

  // --- 自社の輸送（航路と、動いている船・飛行機・トラック） ---
  const shipLayerRef = useRef<L.LayerGroup | null>(null);
  const shipments = state.trade?.shipments ?? [];
  // 1秒ごとに描き直す（毎フレーム作り直すと重いので、残り秒数が変わったときだけ）
  const shipKey = shipments.map((s) => `${s.id}:${Math.round(s.remaining)}`).join(',');

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!shipLayerRef.current) shipLayerRef.current = L.layerGroup().addTo(map);
    const layer = shipLayerRef.current;
    layer.clearLayers();
    const list = state.trade?.shipments ?? [];
    if (list.length === 0) return;
    const hqAt = hqLocation(state);
    const mode = state.settings.numberFormat;

    for (const sh of list) {
      const c = COUNTRY_MAP[sh.country as keyof typeof COUNTRY_MAP];
      if (!c) continue;
      const m = SHIP_MODE_MAP[sh.mode as ShipMode];
      // 荷の向き。仕入れは「相手の港 → 本社」、売り渡しは「本社 → 相手の港」
      const from: [number, number] = sh.kind === 'import' ? [c.lat, c.lon] : [hqAt.lat, hqAt.lon];
      const to: [number, number] = sh.kind === 'import' ? [hqAt.lat, hqAt.lon] : [c.lat, c.lon];
      // 日付変更線をまたぐときは、近いほうを回る
      let lon2 = to[1];
      if (Math.abs(lon2 - from[1]) > 180) lon2 += lon2 > from[1] ? -360 : 360;
      const done = Math.max(0, Math.min(1, 1 - sh.remaining / Math.max(1, sh.totalSeconds)));
      // 少しふくらませて、直線に見えないようにする（航路らしく）
      const mid: [number, number] = [(from[0] + to[0]) / 2 + (lon2 - from[1]) * 0.08, (from[1] + lon2) / 2];
      const path: [number, number][] = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        const la = (1 - t) * (1 - t) * from[0] + 2 * (1 - t) * t * mid[0] + t * t * to[0];
        const lo = (1 - t) * (1 - t) * from[1] + 2 * (1 - t) * t * mid[1] + t * t * lon2;
        path.push([la, lo]);
      }
      const color = sh.kind === 'import' ? '#A47BFF' : '#61C987';
      L.polyline(path, { color, weight: 2, opacity: 0.55, dashArray: '6 6', interactive: false }).addTo(layer);
      // いまどこを走っているか
      const t = done;
      const la = (1 - t) * (1 - t) * from[0] + 2 * (1 - t) * t * mid[0] + t * t * to[0];
      const lo = (1 - t) * (1 - t) * from[1] + 2 * (1 - t) * t * mid[1] + t * t * lon2;
      const glyph = sh.mode === 'air' ? '✈' : sh.mode === 'truck' ? '🚚' : '🚢';
      const marker = L.marker([la, lo], {
        icon: L.divIcon({ className: 'rm-icon', html: `<span class="rm-ship" style="--ship:${color}">${glyph}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] }),
        zIndexOffset: 300,
        interactive: true,
      });
      const res = RESOURCE_MAP[sh.resource as ResourceId];
      marker.bindTooltip(
        `${sh.kind === 'import' ? `${c.name} → 本社` : `本社 → ${c.name}`}<br>${res?.name ?? sh.resource} ${formatQty(sh.resource, sh.qty, mode)}・${m?.name ?? ''}<br>あと ${Math.ceil(sh.remaining)}秒`,
        { direction: 'top', offset: [0, -12] },
      );
      marker.addTo(layer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipKey, ready, hqKey, state.settings.numberFormat]);

  // --- 実在の建物（OpenStreetMap）: 寄ったときだけ読み込む ---
  const customKey = Object.keys(state.estate.custom ?? {}).sort().join(',');
  const numberFormat = state.settings.numberFormat;
  // 3D に渡す配列は、持ち物が変わったときだけ作り直す（毎回作ると 3D が作り直される）
  const ownedIds = useMemo(() => (customKey ? customKey.split(',') : []), [customKey]);
  /**
   * 半径で絞ったあとの建物。
   * 絞ると描く数が減るので、動きはむしろ軽くなる。持っている場所は範囲の外でも必ず残す
   * （自分の持ち物が消えると、売りに行けなくなってしまうため）。
   */
  const shownFeatures = useMemo(() => {
    if (radiusKm == null) return features;
    const c = { lat: centerLat, lon: centerLon };
    const owned = new Set(ownedIds);
    return features.filter((f) => owned.has(f.id) || distanceKm(c, f) <= radiusKm);
  }, [features, radiusKm, centerLat, centerLon, ownedIds]);
  const hiddenByRadius = features.length - shownFeatures.length;

  /*
   * 買えるかどうかを、地図の上でひと目で分かるようにする。
   * 値段の計算は建物の数だけ走るので1回だけにして、
   * 「買える件数」が変わったときにだけ描き直す（所持金は毎秒動くので、
   * そのまま依存に入れると毎秒すべての建物を描き直すことになる）。
   */
  const priced = useMemo(() => shownFeatures.map((f) => ({ f, price: quoteAny(f).basePrice })), [shownFeatures]);
  const cash = state.company.cash;
  const affordCount = useMemo(() => priced.reduce((a, x) => a + (cash >= x.price ? 1 : 0), 0), [priced, cash]);
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
    const ordered = [...priced].sort((a, b) => b.f.areaSqm - a.f.areaSqm);
    const heavy = ordered.length > 300;
    const now = state.company.cash;
    for (const { f, price: listed } of ordered) {
      const owned = getCustom(state, f.id);
      const color = KIND_DEF[owned?.kind ?? f.kind].color;
      const canBuy = !owned && now >= listed;
      /*
       * 3つの見た目に分ける。色だけに頼らず、線の引き方でも変える。
       *   所有中   … 太い実線・濃い塗り（さらに中央に ✓ を置く）
       *   買える   … 実線・はっきりした塗り
       *   資金不足 … 破線・ごく薄い塗り
       */
      const poly = L.polygon(
        f.polygon.map((p) => [p.lat, p.lon] as [number, number]),
        {
          color: owned ? '#FFFFFF' : color,
          weight: owned ? 3.5 : canBuy ? 2.5 : 1,
          opacity: owned ? 1 : canBuy ? 1 : 0.55,
          dashArray: owned || canBuy ? undefined : '4 5',
          fillColor: color,
          fillOpacity: owned ? 0.6 : canBuy ? 0.38 : 0.07,
          className: `rm-osm${owned ? ' rm-osm--owned' : canBuy ? ' rm-osm--buy' : ' rm-osm--poor'}`,
          // 数が多いときは Canvas で描く（SVG だと重くなるため）
          renderer: heavy ? (buildingRendererRef.current ?? undefined) : undefined,
        },
      );
      const price = owned ? customPrice(state, owned) : listed;
      const built = owned ? state.facilities.filter((x) => x.landId === customLandId(f.id)).reduce((a, x) => a + x.count, 0) : 0;
      const stateLabel = owned ? `所有中・施設 ${built}` : canBuy ? `${formatMoney(price, mode)}（買えます）` : `${formatMoney(price, mode)}（あと ${formatMoney(price - now, mode)}）`;
      poly.bindTooltip(
        `${owned?.name ?? f.name}<br>${owned?.label ?? f.label}・${Math.round(f.areaSqm).toLocaleString('ja-JP')}㎡<br>${stateLabel}`,
        { direction: 'top', sticky: true },
      );
      poly.on('click', () => {
        layerClickAtRef.current = Date.now();
        openFeature(f);
      });
      poly.addTo(layer);
      // 持っている場所には印を置く（塗りだけだと、混んだ場所で見失う）
      if (owned) {
        const c = polygonCenter(f.polygon);
        L.marker([c.lat, c.lon], {
          icon: L.divIcon({ className: 'rm-icon', html: '<span class="rm-own">✓</span>', iconSize: [22, 22], iconAnchor: [11, 11] }),
          interactive: false,
          zIndexOffset: 120,
        }).addTo(layer);
      }
    }
  }, [priced, affordCount, zoom, customKey, numberFormat]);

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

  /** 運んでいる荷が全部入るように、地図を寄せる */
  const goShipments = () => {
    const map = mapRef.current;
    const list = state.trade?.shipments ?? [];
    if (!map || list.length === 0) return;
    const hqAt = hqLocation(state);
    const pts: [number, number][] = [[hqAt.lat, hqAt.lon]];
    for (const sh of list) {
      const c = COUNTRY_MAP[sh.country as keyof typeof COUNTRY_MAP];
      if (c) pts.push([c.lat, c.lon]);
    }
    map.fitBounds(L.latLngBounds(pts).pad(0.25), { maxZoom: 6 });
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
          <Button size="sm" disabled={shipments.length === 0} onClick={goShipments}>
            輸送中 {shipments.length > 0 ? `(${shipments.length})` : ''}
          </Button>
          {bulkLevel > 0 && shownFeatures.length > 0 && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                const r = engine.bulkBuyFeatures(shownFeatures);
                setBulkMsg(r.reason ?? `${r.bought}件を買いました`);
                if (r.bought > 0) sfx('buy');
                bumpGame();
              }}
              title="いま地図に出ている物件を、安いものから所持金の半分までまとめて買います"
            >
              表示中を一括買収（最大{BULK_BUY_LIMIT[Math.min(bulkLevel, BULK_BUY_LIMIT.length) - 1]}件）
            </Button>
          )}
        </div>
        <div className="rm__radius">
          <span className="rm__radius-label">絞り込み</span>
          <div className="rm__radius-from">
            <Segmented
              ariaLabel="半径を測る場所"
              items={[
                { id: 'hq', label: '本社から' },
                { id: 'view', label: '地図の中心から' },
              ]}
              value={radiusFrom}
              onChange={(v) => setRadiusFrom(v as 'hq' | 'view')}
            />
          </div>
          <div className="rm__radius-opts" role="group" aria-label="半径">
            {RADIUS_OPTIONS.map((o) => (
              <button
                key={o.label}
                className={`rm__radius-btn${radiusKm === o.km ? ' rm__radius-btn--on' : ''}`}
                onClick={() => {
                  setRadiusKm(o.km);
                  const map = mapRef.current;
                  // 範囲を決めたら、その範囲がちょうど入るところまで引く（円の外を探し続けないように）
                  if (map && o.km != null) map.flyToBounds(L.latLng(centerLat, centerLon).toBounds(o.km * 2200), { duration: 0.6 });
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div className="rm__radius">
          <span className="rm__radius-label">区画を買う</span>
          <div className="rm__radius-opts" role="group" aria-label="区画の大きさ">
            {PLOT_SIZES.map((o) => (
              <button
                key={o.id}
                className={`rm__radius-btn${plotSize === o.id ? ' rm__radius-btn--on' : ''}`}
                title={o.hint}
                onClick={() => {
                  setPlotSize(o.id);
                  // その大きさが押せるところまで寄る（押しても何も出ない、を無くす）
                  const map = mapRef.current;
                  if (map && map.getZoom() < o.minZoom) map.setZoom(o.minZoom);
                }}
              >
                {o.name}
              </button>
            ))}
          </div>
        </div>
        <span className="text-sub" style={{ fontSize: 11 }}>
          {radiusKm != null && zoom >= BUILDING_ZOOM && hiddenByRadius > 0
            ? `${radiusFrom === 'hq' ? '本社' : '地図の中心'}から ${radiusKm}km 以内の ${shownFeatures.length}件だけ出しています（範囲の外の ${hiddenByRadius}件は隠しています）`
            : bulkMsg
            ? bulkMsg
            : zoom < CITY_ZOOM
            ? '丸は物件のある都市。タップで寄る。▲は施設を建てられる産業用地（タップで購入）'
            : zoom < BUILDING_ZOOM
              ? 'ピンをタップで詳細。もう少し寄ると、実在の建物を買えるようになります'
              : osmState === 'loading'
                ? 'この辺りの建物を読み込み中…'
                : osmState === 'error'
                  ? `建物を読み込めませんでした（${osmError ?? '通信エラー'}）。少し待つか、地図を動かすと再試行します`
                  : `建物をタップすると買えます。何も無いところをタップすると、その足もとを${PLOT_SIZE_MAP[plotSize].name}（${PLOT_SIZE_MAP[plotSize].hint}）として買えます`}
        </span>
      </div>
      <div className="rm__stage">
        {/*
          * どこまで寄れば建物を買えるのかが分からない、という迷いを無くす。
          * いまの倍率と、建物が出る倍率までの残りを地図の上にそのまま出し、
          * 押せば一息でそこまで寄れるようにする。
          */}
        {!use3D && (
          <button
            type="button"
            className={`rm__zoomhint${zoom >= BUILDING_ZOOM ? ' rm__zoomhint--on' : ''}`}
            onClick={() => {
              const map = mapRef.current;
              if (!map) return;
              if (zoom >= BUILDING_ZOOM) return;
              map.setZoom(BUILDING_ZOOM);
            }}
            disabled={zoom >= BUILDING_ZOOM}
          >
            {zoom >= BUILDING_ZOOM ? (
              <>
                <b>建物が出ています</b>
                <small>押すと買えます</small>
              </>
            ) : (
              <>
                <b>あと {BUILDING_ZOOM - zoom} 段階で建物が出ます</b>
                <small>押すとそこまで寄ります</small>
              </>
            )}
            <span className="rm__zoombar" aria-hidden="true">
              <span style={{ width: `${Math.min(100, Math.max(0, ((zoom - 4) / (BUILDING_ZOOM - 4)) * 100))}%` }} />
            </span>
          </button>
        )}

        {/* 立体表示の切り替えは、地図を見ながら押せるよう地図の右上に小さく置く */}
        {canUse3D && (
          <button
            type="button"
            className={`rm__3d${use3D ? ' rm__3d--on' : ''}`}
            onClick={() => {
              setThreeDError(null);
              engine.updateSettings({ map3D: !wants3D });
              bumpGame();
            }}
            title={use3D ? '平面（2D）に戻します' : '近づいた場所を立体で表示します（端末によっては重くなります）'}
          >
            {use3D ? '2D' : '3D'}
          </button>
        )}
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
              features={shownFeatures}
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
          <span className="rm-swatch rm-swatch--buy" />
          <span>
            <strong>買える</strong>
            <small>実線・色が濃い</small>
          </span>
        </span>
        <span className="rm__legend-item">
          <span className="rm-swatch rm-swatch--poor" />
          <span>
            <strong>資金不足</strong>
            <small>破線・色がごく薄い</small>
          </span>
        </span>
        <span className="rm__legend-item">
          <span className="rm-swatch rm-swatch--owned">✓</span>
          <span>
            <strong>所有中</strong>
            <small>白い太枠と ✓ の印</small>
          </span>
        </span>
        <span className="rm__legend-item">
          <span className="rm-hq">株</span>
          <span>
            <strong>会社の本社</strong>
            <small>株を売買できる</small>
          </span>
        </span>
        <span className="rm__legend-item">
          <span className="rm-land">▲</span>
          <span>
            <strong>産業用地</strong>
            <small>押すと買える／黄色は所有中</small>
          </span>
        </span>
        <span className="rm__legend-item">
          <span className="rm-hqself" style={{ fontSize: 9 }}>本社</span>
          <span>
            <strong>自社の本社</strong>
            <small>ここが起点</small>
          </span>
        </span>
      </div>
      <p className="text-dim" style={{ fontSize: 11 }}>
        地図・建物のデータ: © OpenStreetMap contributors（ODbL）。名前は実在の施設をもじった架空のもので、価格は公示地価などを参考にしたゲーム用の値です。会社はすべて架空です。
      </p>
    </div>
  );
}
