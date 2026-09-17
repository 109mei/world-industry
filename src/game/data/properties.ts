import type { CityId } from './cities';

/**
 * 実在の場所に置いた不動産（土地・物件）。
 * 価格は公示地価（2026年）や海外の相場を参考にした「実勢に近い水準」の円建てだが、
 * 物件そのもの（建物・所有者）は架空。実在の企業・個人の資産ではない。
 */
export type PropertyKind = 'land' | 'farm' | 'house' | 'apartment' | 'office' | 'retail' | 'hotel' | 'warehouse' | 'factory' | 'resort';

export interface PropertyKindDef {
  label: string;
  icon: string;
  /** 賃料の利回り（価格に対する1時間あたりの割合） */
  yield: number;
  /** 地図のマーカー色 */
  color: string;
}

export const PROPERTY_KIND: Record<PropertyKind, PropertyKindDef> = {
  land: { label: '土地', icon: 'icon_terrain_grass', yield: 0.02, color: '#8fbf6a' },
  farm: { label: '農地・牧場', icon: 'icon_terrain_farmland', yield: 0.05, color: '#c9a84a' },
  house: { label: '住宅', icon: 'icon_terrain_residential', yield: 0.07, color: '#e58c6a' },
  apartment: { label: 'マンション', icon: 'icon_commercial_apartment', yield: 0.09, color: '#e26f8f' },
  office: { label: 'オフィス', icon: 'icon_commercial_office', yield: 0.1, color: '#5ea7ff' },
  retail: { label: '商業ビル・店舗', icon: 'icon_commercial_mall', yield: 0.12, color: '#a47bff' },
  hotel: { label: 'ホテル', icon: 'icon_commercial_hotel', yield: 0.14, color: '#f2b94a' },
  warehouse: { label: '倉庫・物流', icon: 'icon_commercial_warehouse', yield: 0.09, color: '#7f8ea3' },
  factory: { label: '工場・工業用地', icon: 'icon_marker_factory', yield: 0.1, color: '#c96b6b' },
  resort: { label: 'リゾート', icon: 'icon_terrain_island', yield: 0.13, color: '#4fc3c9' },
};

export interface PropertyDef {
  id: string;
  name: string;
  city: CityId;
  kind: PropertyKind;
  lat: number;
  lon: number;
  /** 面積（㎡）。建物は延床、土地は敷地 */
  area: number;
  /** 基準価格（円） */
  price: number;
  /** 利回りを種類の既定値から変える場合 */
  yield?: number;
  description: string;
}

const OKU = 100_000_000;
const MAN = 10_000;

export const PROPERTIES = [
  // ---- 東京 ----
  { id: 'tk_ginza_bldg', name: '銀座4丁目の商業ビル', city: 'tokyo', kind: 'retail', lat: 35.6717, lon: 139.7649, area: 1400, price: 140 * OKU, description: '敷地200㎡・延床1,400㎡。公示地価 6,710万円/㎡（2026年、全国最高地点）に近い一等地。' },
  { id: 'tk_marunouchi_office', name: '丸の内のオフィスビル', city: 'tokyo', kind: 'office', lat: 35.6815, lon: 139.7645, area: 3000, price: 180 * OKU, description: '東京駅前のオフィス床3,000㎡。公示地価 3,760万円/㎡の地区。' },
  { id: 'tk_shinjuku_bldg', name: '新宿3丁目の商業ビル', city: 'tokyo', kind: 'retail', lat: 35.691, lon: 139.704, area: 900, price: 70 * OKU, description: '公示地価 4,200万円/㎡の新宿三丁目。テナントは飲食と物販。' },
  { id: 'tk_shibuya_office', name: '渋谷・宇田川町のオフィスビル', city: 'tokyo', kind: 'office', lat: 35.6613, lon: 139.6985, area: 2000, price: 95 * OKU, description: 'IT企業が集まる渋谷。公示地価 3,530万円/㎡。' },
  { id: 'tk_akasaka_house', name: '赤坂の邸宅', city: 'tokyo', kind: 'house', lat: 35.67, lon: 139.74, area: 400, price: 31 * OKU, description: '住宅地の公示地価で全国1位（711万円/㎡）の赤坂1丁目。土地400㎡。' },
  { id: 'tk_minato_tower', name: '港区のタワーマンション（1室）', city: 'tokyo', kind: 'apartment', lat: 35.658, lon: 139.736, area: 120, price: 4.5 * OKU, description: '高層階の120㎡。港区の新築タワーは1㎡300万円超。' },
  { id: 'tk_setagaya_house', name: '世田谷・成城の一戸建て', city: 'tokyo', kind: 'house', lat: 35.642, lon: 139.599, area: 150, price: 1.5 * OKU, description: '土地150㎡・建物付き。成城の住宅地は約80万円/㎡。' },
  { id: 'tk_koto_warehouse', name: '江東区の物流倉庫', city: 'tokyo', kind: 'warehouse', lat: 35.644, lon: 139.827, area: 5000, price: 40 * OKU, description: '湾岸の物流拠点。延床5,000㎡。' },
  { id: 'tk_nakano_apart', name: '中野のアパート一棟', city: 'tokyo', kind: 'apartment', lat: 35.706, lon: 139.665, area: 300, price: 2.5 * OKU, description: '8室の木造アパート。駅から徒歩8分。' },
  { id: 'tk_odaiba_hotel', name: '台場のホテル', city: 'tokyo', kind: 'hotel', lat: 35.63, lon: 139.775, area: 12000, price: 250 * OKU, description: '200室のシティホテル。観光需要で稼働率が高い。' },
  { id: 'tk_hachioji_land', name: '八王子の空き地', city: 'tokyo', kind: 'land', lat: 35.666, lon: 139.316, area: 1000, price: 2 * OKU, description: '駅から少し離れた1,000㎡の更地（約20万円/㎡）。' },
  { id: 'tk_haneda_hangar', name: '羽田の航空貨物倉庫', city: 'tokyo', kind: 'warehouse', lat: 35.5494, lon: 139.7798, area: 8000, price: 60 * OKU, description: '空港に隣接する貨物上屋。' },
  // ---- 横浜 ----
  { id: 'yk_station_bldg', name: '横浜駅西口の商業ビル', city: 'yokohama', kind: 'retail', lat: 35.466, lon: 139.62, area: 1500, price: 60 * OKU, description: '横浜駅前の商業地は約1,300万円/㎡。' },
  { id: 'yk_mm_tower', name: 'みなとみらいのタワーマンション（1室）', city: 'yokohama', kind: 'apartment', lat: 35.456, lon: 139.633, area: 90, price: 2 * OKU, description: '海が見える90㎡。' },
  { id: 'yk_kohoku_house', name: '港北ニュータウンの一戸建て', city: 'yokohama', kind: 'house', lat: 35.553, lon: 139.575, area: 130, price: 8000 * MAN, description: '土地130㎡の新築住宅。' },
  // ---- 大阪 ----
  { id: 'os_dotonbori_bldg', name: '道頓堀の商業ビル', city: 'osaka', kind: 'retail', lat: 34.6687, lon: 135.5013, area: 1200, price: 80 * OKU, description: 'なんば周辺は公示地価 2,500万円/㎡（2026年、大阪最高）。' },
  { id: 'os_umeda_office', name: '梅田のオフィスビル', city: 'osaka', kind: 'office', lat: 34.7025, lon: 135.4959, area: 4000, price: 100 * OKU, description: '大阪駅周辺（公示地価 2,470万円/㎡）のオフィス床4,000㎡。' },
  { id: 'os_shinsaibashi_shop', name: '心斎橋の店舗', city: 'osaka', kind: 'retail', lat: 34.6738, lon: 135.501, area: 400, price: 25 * OKU, description: '心斎橋筋（公示地価 1,990万円/㎡）の路面店。' },
  { id: 'os_kitahama_condo', name: '北浜の分譲マンション（1室）', city: 'osaka', kind: 'apartment', lat: 34.691, lon: 135.506, area: 80, price: 9000 * MAN, description: '川沿いの80㎡。' },
  { id: 'os_higashiosaka_factory', name: '東大阪の町工場', city: 'osaka', kind: 'factory', lat: 34.679, lon: 135.601, area: 800, price: 2.4 * OKU, description: 'ものづくりの街の小さな工場。敷地800㎡。' },
  { id: 'os_sakai_logistics', name: '堺の物流センター', city: 'osaka', kind: 'warehouse', lat: 34.573, lon: 135.483, area: 8000, price: 45 * OKU, description: '臨海部の大型倉庫。' },
  // ---- 京都・神戸 ----
  { id: 'kt_shijo_bldg', name: '四条河原町の商業ビル', city: 'kyoto', kind: 'retail', lat: 35.0038, lon: 135.769, area: 800, price: 20 * OKU, description: '京都随一の繁華街（約900万円/㎡）。' },
  { id: 'kt_higashiyama_machiya', name: '東山の町家', city: 'kyoto', kind: 'house', lat: 34.999, lon: 135.78, area: 120, price: 1.5 * OKU, description: '改装済みの京町家。宿にも使える。' },
  { id: 'kb_sannomiya_office', name: '三宮のオフィスビル', city: 'kobe', kind: 'office', lat: 34.695, lon: 135.195, area: 1800, price: 25 * OKU, description: '神戸の中心地（約700万円/㎡）。' },
  { id: 'kb_port_warehouse', name: '神戸港の倉庫', city: 'kobe', kind: 'warehouse', lat: 34.68, lon: 135.22, area: 6000, price: 15 * OKU, description: 'コンテナ埠頭に近い倉庫。' },
  // ---- 名古屋 ----
  { id: 'ng_meieki_office', name: '名駅前のオフィスビル', city: 'nagoya', kind: 'office', lat: 35.1709, lon: 136.8815, area: 3500, price: 90 * OKU, description: '名古屋駅前は約2,000万円/㎡。' },
  { id: 'ng_sakae_bldg', name: '栄の商業ビル', city: 'nagoya', kind: 'retail', lat: 35.168, lon: 136.908, area: 700, price: 30 * OKU, description: '栄の繁華街。' },
  { id: 'ng_mizuho_house', name: '瑞穂区の一戸建て', city: 'nagoya', kind: 'house', lat: 35.133, lon: 136.933, area: 160, price: 6500 * MAN, description: '閑静な住宅地。' },
  { id: 'ng_port_warehouse', name: '名古屋港の倉庫', city: 'nagoya', kind: 'warehouse', lat: 35.09, lon: 136.883, area: 4000, price: 20 * OKU, description: '自動車部品の物流に使われる倉庫。' },
  // ---- 福岡 ----
  { id: 'fk_tenjin_bldg', name: '天神の商業ビル', city: 'fukuoka', kind: 'retail', lat: 33.5904, lon: 130.4017, area: 1000, price: 38 * OKU, description: '天神の商業地は約1,400万円/㎡。再開発で上昇中。' },
  { id: 'fk_hakata_office', name: '博多駅前のオフィスビル', city: 'fukuoka', kind: 'office', lat: 33.5897, lon: 130.4207, area: 1500, price: 25 * OKU, description: '博多駅筑紫口のオフィス。' },
  { id: 'fk_ohori_condo', name: '大濠公園そばのマンション（1室）', city: 'fukuoka', kind: 'apartment', lat: 33.586, lon: 130.376, area: 90, price: 1.2 * OKU, description: '公園に面した90㎡。' },
  { id: 'fk_itoshima_land', name: '糸島の海沿いの土地', city: 'fukuoka', kind: 'land', lat: 33.556, lon: 130.195, area: 800, price: 4800 * MAN, description: '海が見える800㎡（約6万円/㎡）。' },
  // ---- 飯塚・嘉穂 ----
  { id: 'iz_house_lot', name: '飯塚市の住宅用地', city: 'iizuka', kind: 'land', lat: 33.6459, lon: 130.6915, area: 300, price: 900 * MAN, description: '300㎡の住宅地（約3万円/㎡）。最初に買える物件のひとつ。' },
  { id: 'iz_shop', name: '飯塚の商店街の空き店舗', city: 'iizuka', kind: 'retail', lat: 33.644, lon: 130.69, area: 150, price: 1200 * MAN, description: 'アーケードの空き店舗。安く買えて利回りは高い。' },
  { id: 'iz_forest', name: '嘉穂の山林', city: 'iizuka', kind: 'land', lat: 33.58, lon: 130.72, area: 50000, price: 500 * MAN, description: '5haの山林（約100円/㎡）。' },
  { id: 'iz_solar_land', name: '飯塚の太陽光発電用地', city: 'iizuka', kind: 'land', lat: 33.62, lon: 130.71, area: 20000, price: 1 * OKU, description: 'パネルが並ぶ2haの土地。', yield: 0.06 },
  { id: 'iz_apartment', name: '新飯塚駅前のアパート一棟', city: 'iizuka', kind: 'apartment', lat: 33.648, lon: 130.698, area: 400, price: 6000 * MAN, description: '学生向けの12室。' },
  // ---- 熊本 ----
  { id: 'km_kikuyo_industrial', name: '菊陽町の工業用地', city: 'kumamoto', kind: 'factory', lat: 32.869, lon: 130.83, area: 10000, price: 8 * OKU, description: '半導体工場の集積で地価が急上昇している地区。' },
  { id: 'km_kikuyo_apart', name: '菊陽町の新築アパート一棟', city: 'kumamoto', kind: 'apartment', lat: 32.875, lon: 130.825, area: 500, price: 1.5 * OKU, description: '工場で働く人向けの16室。' },
  // ---- 札幌・北海道 ----
  { id: 'sp_odori_office', name: '大通のオフィスビル', city: 'sapporo', kind: 'office', lat: 43.06, lon: 141.354, area: 3000, price: 40 * OKU, description: '札幌の中心（約700万円/㎡）。' },
  { id: 'sp_susukino_bldg', name: 'ススキノの商業ビル', city: 'sapporo', kind: 'retail', lat: 43.055, lon: 141.353, area: 800, price: 18 * OKU, description: '北の歓楽街。' },
  { id: 'sp_maruyama_condo', name: '円山のマンション（1室）', city: 'sapporo', kind: 'apartment', lat: 43.056, lon: 141.317, area: 85, price: 6000 * MAN, description: '札幌の高級住宅地。' },
  { id: 'sp_tomakomai_industrial', name: '苫小牧の工業用地', city: 'sapporo', kind: 'factory', lat: 42.634, lon: 141.605, area: 50000, price: 10 * OKU, description: '港に近い5haの工業用地。' },
  { id: 'hk_tokachi_farm', name: '十勝の農地', city: 'hokkaido_rural', kind: 'farm', lat: 42.92, lon: 143.2, area: 200000, price: 6000 * MAN, description: '20haの畑（約300円/㎡）。' },
  { id: 'hk_furano_land', name: '富良野の土地', city: 'hokkaido_rural', kind: 'land', lat: 43.342, lon: 142.383, area: 2000, price: 600 * MAN, description: '丘の上の2,000㎡。' },
  { id: 'hk_nemuro_wilderness', name: '道東の原野', city: 'hokkaido_rural', kind: 'land', lat: 43.33, lon: 145.58, area: 100000, price: 250 * MAN, description: '10haの原野（約25円/㎡）。いちばん安い土地。' },
  { id: 'ns_condo', name: 'ニセコのコンドミニアム（1室）', city: 'niseko', kind: 'resort', lat: 42.862, lon: 140.687, area: 110, price: 3.5 * OKU, description: '海外の投資家に人気で、地価上昇率は全国トップ級。' },
  { id: 'ns_dev_land', name: 'ニセコの開発用地', city: 'niseko', kind: 'land', lat: 42.87, lon: 140.68, area: 5000, price: 7.5 * OKU, description: 'スキー場に近い5,000㎡（約15万円/㎡）。' },
  // ---- 仙台・広島 ----
  { id: 'sd_station_bldg', name: '仙台駅前のオフィスビル', city: 'sendai', kind: 'office', lat: 38.26, lon: 140.882, area: 2500, price: 22 * OKU, description: '東北の中心都市。' },
  { id: 'hr_kamiyacho_bldg', name: '紙屋町の商業ビル', city: 'hiroshima', kind: 'retail', lat: 34.395, lon: 132.457, area: 900, price: 20 * OKU, description: '広島の中心（約400万円/㎡）。' },
  // ---- 沖縄 ----
  { id: 'ok_kokusai_shop', name: '那覇・国際通りの店舗', city: 'okinawa', kind: 'retail', lat: 26.215, lon: 127.687, area: 300, price: 6 * OKU, description: '観光客でにぎわう通り。' },
  { id: 'ok_onna_resort', name: '恩納村のリゾートホテル', city: 'okinawa', kind: 'hotel', lat: 26.497, lon: 127.853, area: 15000, price: 120 * OKU, description: 'ビーチ沿い150室。' },
  { id: 'ok_ishigaki_land', name: '石垣島の土地', city: 'okinawa', kind: 'land', lat: 24.34, lon: 124.156, area: 3000, price: 1.5 * OKU, description: '海に近い3,000㎡。' },
  // ---- 軽井沢・白馬・浜松 ----
  { id: 'nn_karuizawa_villa', name: '軽井沢の別荘', city: 'nagano', kind: 'house', lat: 36.342, lon: 138.635, area: 1500, price: 2.5 * OKU, description: '林の中の1,500㎡の敷地。' },
  { id: 'nn_hakuba_lodge', name: '白馬のロッジ', city: 'nagano', kind: 'resort', lat: 36.698, lon: 137.862, area: 600, price: 3 * OKU, description: '外国人スキー客で冬は満室。' },
  { id: 'hm_auto_plant', name: '浜松の自動車工場', city: 'hamamatsu', kind: 'factory', lat: 34.7108, lon: 137.7261, area: 100000, price: 150 * OKU, description: '10haの組立工場。' },
  // ---- ニューヨーク・サンフランシスコ ----
  { id: 'ny_fifth_ave_retail', name: '5番街の商業ビル', city: 'new_york', kind: 'retail', lat: 40.763, lon: -73.973, area: 4000, price: 600 * OKU, description: '世界一賃料が高い通り。約4億ドル。' },
  { id: 'ny_midtown_office', name: 'ミッドタウンのオフィスビル', city: 'new_york', kind: 'office', lat: 40.755, lon: -73.984, area: 60000, price: 1800 * OKU, description: '約12億ドルの高層オフィス。' },
  { id: 'ny_ues_townhouse', name: 'アッパーイーストサイドのタウンハウス', city: 'new_york', kind: 'house', lat: 40.774, lon: -73.96, area: 600, price: 37.5 * OKU, description: '約2,500万ドル。' },
  { id: 'ny_brooklyn_warehouse', name: 'ブルックリンの倉庫', city: 'new_york', kind: 'warehouse', lat: 40.675, lon: -74.01, area: 9000, price: 90 * OKU, description: '港に面した倉庫。約6,000万ドル。' },
  { id: 'ny_queens_apart', name: 'クイーンズの集合住宅', city: 'new_york', kind: 'apartment', lat: 40.74, lon: -73.88, area: 2500, price: 30 * OKU, description: '30室のアパート。約2,000万ドル。' },
  { id: 'sf_soma_office', name: 'SoMaのオフィスビル', city: 'san_francisco', kind: 'office', lat: 37.783, lon: -122.4, area: 20000, price: 450 * OKU, description: 'テック企業が入るオフィス。約3億ドル。' },
  { id: 'sf_palo_alto_house', name: 'パロアルトの住宅', city: 'san_francisco', kind: 'house', lat: 37.4419, lon: -122.143, area: 300, price: 9 * OKU, description: 'シリコンバレーの一戸建て。約600万ドル。' },
  // ---- テキサス・ハワイ・トロント ----
  { id: 'tx_ranch', name: 'テキサスの牧場', city: 'texas', kind: 'farm', lat: 35.2, lon: -101.8, area: 8_000_000, price: 5.9 * OKU, description: '800ha（約2,000ドル/エーカー）。' },
  { id: 'tx_houston_industrial', name: 'ヒューストンの工業団地', city: 'texas', kind: 'factory', lat: 29.76, lon: -95.27, area: 80000, price: 60 * OKU, description: '石油化学プラントが並ぶ地区。約4,000万ドル。' },
  { id: 'hi_waikiki_condo', name: 'ワイキキのコンドミニアム', city: 'hawaii', kind: 'resort', lat: 21.279, lon: -157.829, area: 100, price: 3.75 * OKU, description: '海が見える100㎡。約250万ドル。' },
  { id: 'hi_maui_land', name: 'マウイ島の土地', city: 'hawaii', kind: 'land', lat: 20.764, lon: -156.445, area: 8000, price: 4.5 * OKU, description: '約300万ドル。' },
  { id: 'to_condo', name: 'トロント・ダウンタウンのコンドミニアム', city: 'toronto', kind: 'apartment', lat: 43.648, lon: -79.38, area: 80, price: 1.3 * OKU, description: '約120万カナダドル。' },
  // ---- ロンドン・パリ・ベルリン ----
  { id: 'ld_mayfair_townhouse', name: 'メイフェアのタウンハウス', city: 'london', kind: 'house', lat: 51.51, lon: -0.147, area: 700, price: 78 * OKU, description: '約4,000万ポンド。' },
  { id: 'ld_city_office', name: 'シティのオフィスビル', city: 'london', kind: 'office', lat: 51.515, lon: -0.09, area: 40000, price: 975 * OKU, description: '金融街の高層ビル。約5億ポンド。' },
  { id: 'ld_bond_street_shop', name: 'ボンドストリートの店舗ビル', city: 'london', kind: 'retail', lat: 51.513, lon: -0.144, area: 1500, price: 292 * OKU, description: '高級ブランドの旗艦店。約1.5億ポンド。' },
  { id: 'ld_camden_flat', name: 'カムデンのフラット', city: 'london', kind: 'apartment', lat: 51.539, lon: -0.142, area: 70, price: 1.75 * OKU, description: '約90万ポンド。' },
  { id: 'pr_champs_bldg', name: 'シャンゼリゼ通りの商業ビル', city: 'paris', kind: 'retail', lat: 48.8698, lon: 2.3078, area: 5000, price: 495 * OKU, description: '約3億ユーロ。' },
  { id: 'pr_marais_apart', name: 'マレ地区のアパルトマン', city: 'paris', kind: 'apartment', lat: 48.857, lon: 2.362, area: 110, price: 3.3 * OKU, description: '約200万ユーロ。' },
  { id: 'bl_mitte_office', name: 'ミッテのオフィスビル', city: 'berlin', kind: 'office', lat: 52.52, lon: 13.405, area: 12000, price: 198 * OKU, description: '約1.2億ユーロ。' },
  { id: 'bl_kreuzberg_apart', name: 'クロイツベルクの集合住宅', city: 'berlin', kind: 'apartment', lat: 52.499, lon: 13.403, area: 3000, price: 24.75 * OKU, description: '40室。約1,500万ユーロ。' },
  // ---- シンガポール・香港・上海 ----
  { id: 'sg_orchard_mall', name: 'オーチャードの商業ビル', city: 'singapore', kind: 'retail', lat: 1.304, lon: 103.832, area: 30000, price: 904 * OKU, description: '約8億シンガポールドル。' },
  { id: 'sg_marina_condo', name: 'マリーナベイのコンドミニアム（1室）', city: 'singapore', kind: 'apartment', lat: 1.283, lon: 103.86, area: 150, price: 6.8 * OKU, description: '約600万シンガポールドル。' },
  { id: 'sg_jurong_factory', name: 'ジュロンの工場', city: 'singapore', kind: 'factory', lat: 1.333, lon: 103.71, area: 20000, price: 45 * OKU, description: '約4,000万シンガポールドル。' },
  { id: 'hk_central_office', name: 'セントラルのオフィスフロア', city: 'hong_kong', kind: 'office', lat: 22.281, lon: 114.158, area: 4000, price: 290 * OKU, description: '約15億香港ドル。' },
  { id: 'hk_tst_shop', name: '尖沙咀の店舗', city: 'hong_kong', kind: 'retail', lat: 22.297, lon: 114.172, area: 300, price: 58 * OKU, description: '約3億香港ドル。' },
  { id: 'sh_lujiazui_office', name: '陸家嘴のオフィスビル', city: 'shanghai', kind: 'office', lat: 31.24, lon: 121.5, area: 30000, price: 420 * OKU, description: '約20億元。' },
  { id: 'sh_jingan_condo', name: '静安区のマンション（1室）', city: 'shanghai', kind: 'apartment', lat: 31.228, lon: 121.448, area: 140, price: 5.25 * OKU, description: '約2,500万元。' },
  // ---- ソウル・台北 ----
  { id: 'se_gangnam_office', name: '江南のオフィスビル', city: 'seoul', kind: 'office', lat: 37.498, lon: 127.028, area: 25000, price: 660 * OKU, description: '約6,000億ウォン。' },
  { id: 'se_myeongdong_shop', name: '明洞の店舗ビル', city: 'seoul', kind: 'retail', lat: 37.5636, lon: 126.985, area: 600, price: 88 * OKU, description: '韓国で最も地価が高い通り。約800億ウォン。' },
  { id: 'tp_xinyi_office', name: '信義区のオフィスビル', city: 'taipei', kind: 'office', lat: 25.033, lon: 121.5654, area: 20000, price: 376 * OKU, description: '約80億台湾ドル。' },
  { id: 'tp_hsinchu_fab', name: '新竹の半導体工場用地', city: 'taipei', kind: 'factory', lat: 24.78, lon: 121.01, area: 60000, price: 70 * OKU, description: '約15億台湾ドル。' },
  // ---- ドバイ ----
  { id: 'db_downtown_hotel', name: 'ダウンタウンの高層ホテル', city: 'dubai', kind: 'hotel', lat: 25.197, lon: 55.274, area: 50000, price: 820 * OKU, description: '約20億ディルハム。' },
  { id: 'db_palm_villa', name: 'パームジュメイラのヴィラ', city: 'dubai', kind: 'house', lat: 25.112, lon: 55.139, area: 900, price: 24.6 * OKU, description: '約6,000万ディルハム。' },
  { id: 'db_marina_apart', name: 'ドバイマリーナのアパート', city: 'dubai', kind: 'apartment', lat: 25.08, lon: 55.14, area: 120, price: 1.23 * OKU, description: '約300万ディルハム。' },
  // ---- シドニー・豪州内陸 ----
  { id: 'sy_cbd_office', name: 'シドニーCBDのオフィスビル', city: 'sydney', kind: 'office', lat: -33.8688, lon: 151.2093, area: 35000, price: 700 * OKU, description: '約7億豪ドル。' },
  { id: 'sy_bondi_house', name: 'ボンダイビーチの住宅', city: 'sydney', kind: 'house', lat: -33.8915, lon: 151.2767, area: 400, price: 8 * OKU, description: '約800万豪ドル。' },
  { id: 'au_outback_station', name: '豪州内陸の牧場', city: 'outback', kind: 'farm', lat: -23.44, lon: 144.25, area: 100_000_000, price: 5000 * MAN, description: '1万ha（約50豪ドル/ha）。広さだけなら世界一。' },
  { id: 'au_kalgoorlie_land', name: 'カルグーリーの鉱区用地', city: 'outback', kind: 'land', lat: -30.749, lon: 121.466, area: 200000, price: 3000 * MAN, description: '金鉱の町の20ha。' },
  // ---- バンコク・ムンバイ ----
  { id: 'bk_sukhumvit_condo', name: 'スクンビットのコンドミニアム', city: 'bangkok', kind: 'apartment', lat: 13.738, lon: 100.56, area: 90, price: 1.3 * OKU, description: '約3,000万バーツ。' },
  { id: 'bk_siam_mall', name: 'サイアムの商業ビル', city: 'bangkok', kind: 'retail', lat: 13.746, lon: 100.534, area: 20000, price: 215 * OKU, description: '約50億バーツ。' },
  { id: 'mb_bandra_apart', name: 'バンドラのアパート', city: 'mumbai', kind: 'apartment', lat: 19.06, lon: 72.83, area: 150, price: 2.6 * OKU, description: '約1.5億ルピー。' },
  { id: 'mb_bkc_office', name: 'BKCのオフィスビル', city: 'mumbai', kind: 'office', lat: 19.065, lon: 72.868, area: 30000, price: 350 * OKU, description: '約200億ルピー。' },
  // ---- サンパウロ・マットグロッソ・アタカマ ----
  { id: 'sp_paulista_office', name: 'パウリスタ通りのオフィスビル', city: 'sao_paulo', kind: 'office', lat: -23.561, lon: -46.656, area: 25000, price: 216 * OKU, description: '約8億レアル。' },
  { id: 'mg_farm', name: 'マットグロッソの大農場', city: 'mato_grosso', kind: 'farm', lat: -12.545, lon: -55.721, area: 50_000_000, price: 30 * OKU, description: '5,000haの大豆農場。' },
  { id: 'at_mining_land', name: 'アタカマの鉱区用地', city: 'atacama', kind: 'land', lat: -22.46, lon: -68.93, area: 50000, price: 7500 * MAN, description: '銅山のふもとの5ha。' },
] as const satisfies readonly PropertyDef[];

export type PropertyId = (typeof PROPERTIES)[number]['id'];
export const PROPERTY_MAP: Record<PropertyId, PropertyDef> = Object.fromEntries(PROPERTIES.map((p) => [p.id, p])) as unknown as Record<PropertyId, PropertyDef>;

export function isPropertyId(id: string): id is PropertyId {
  return id in PROPERTY_MAP;
}

/** その物件の賃料利回り（1時間あたり） */
export function propertyYield(def: PropertyDef): number {
  return def.yield ?? PROPERTY_KIND[def.kind].yield;
}
