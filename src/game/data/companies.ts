import type { PropertyId } from './properties';

/**
 * 株式を売買できる会社。すべて架空で、実在の企業とは関係ない（本社の場所だけ実在の都市）。
 * baseCap は事業の価値（円）。株価 = (事業価値 × 成長倍率 + 内部留保 + 所有物件の価値) ÷ 発行株数 × 需給係数。
 */
export type Sector = 'realestate' | 'energy' | 'mining' | 'construction' | 'logistics' | 'food' | 'shipping' | 'finance' | 'heavy' | 'airline' | 'it' | 'semiconductor' | 'trading' | 'auto' | 'agri' | 'hotel' | 'steel';

export const SECTOR_LABEL: Record<Sector, { label: string; icon: string }> = {
  realestate: { label: '不動産', icon: 'icon_commercial_office' },
  energy: { label: 'エネルギー', icon: 'icon_power_transmission_tower' },
  mining: { label: '鉱業', icon: 'icon_marker_mine' },
  construction: { label: '建設', icon: 'icon_machine_tower_crane' },
  logistics: { label: '運輸・物流', icon: 'icon_logistics_truck' },
  food: { label: '食品', icon: 'icon_food_bread' },
  shipping: { label: '海運', icon: 'icon_logistics_ship' },
  finance: { label: '金融', icon: 'icon_commercial_bank' },
  heavy: { label: '重工業', icon: 'icon_facility_steel_mill' },
  airline: { label: '航空', icon: 'icon_logistics_airplane' },
  it: { label: 'IT', icon: 'icon_office_server_rack' },
  semiconductor: { label: '半導体', icon: 'icon_material_semiconductor' },
  trading: { label: '商社', icon: 'icon_office_contract' },
  auto: { label: '自動車', icon: 'icon_facility_vehicle_factory' },
  agri: { label: '農業', icon: 'icon_facility_farm' },
  hotel: { label: 'リゾート', icon: 'icon_commercial_hotel' },
  steel: { label: '鉄鋼', icon: 'icon_material_steel' },
};

export interface CompanyDef {
  id: string;
  name: string;
  sector: Sector;
  /** 本社の場所（表示用） */
  hq: string;
  lat: number;
  lon: number;
  /** 事業の価値（円）。所有物件は含まない */
  baseCap: number;
  /** 発行株式数 */
  shares: number;
  /** 1時間あたりの利益 ÷ 事業価値 */
  earningsYield: number;
  /** 株価のぶれ（1時間あたりの標準偏差） */
  volatility: number;
  /** 所有している物件 */
  properties: PropertyId[];
  description: string;
}

const OKU = 100_000_000;
const CHO = 1_000_000_000_000;

export const COMPANIES = [
  // ---- 日本（小さい順） ----
  { id: 'chikuho_energy', name: '筑豊エナジー', sector: 'energy', hq: '福岡・飯塚', lat: 33.6459, lon: 130.6915, baseCap: 30 * OKU, shares: 1_000_000, earningsYield: 0.15, volatility: 0.05, properties: ['iz_solar_land'], description: '旧炭鉱地帯で太陽光発電をする小さな会社。最初の買収相手に向く。' },
  { id: 'genkai_resort', name: '玄海リゾート', sector: 'hotel', hq: '沖縄・那覇', lat: 26.2124, lon: 127.6809, baseCap: 250 * OKU, shares: 5_000_000, earningsYield: 0.11, volatility: 0.06, properties: ['ok_onna_resort'], description: '沖縄でホテルを運営。観光客の増減で株価が動く。' },
  { id: 'kokuyo_mining', name: '黒曜鉱業', sector: 'mining', hq: '秋田', lat: 39.72, lon: 140.1, baseCap: 400 * OKU, shares: 10_000_000, earningsYield: 0.12, volatility: 0.08, properties: [], description: '金属鉱山を掘る会社。相場しだいで利益が大きく変わる。' },
  { id: 'aoba_kensetsu', name: '青葉建設', sector: 'construction', hq: '仙台', lat: 38.2682, lon: 140.8694, baseCap: 700 * OKU, shares: 20_000_000, earningsYield: 0.07, volatility: 0.03, properties: ['sd_station_bldg'], description: '東北のゼネコン。' },
  { id: 'shirakaba_estate', name: '白樺不動産', sector: 'realestate', hq: '東京・丸の内', lat: 35.683, lon: 139.765, baseCap: 800 * OKU, shares: 50_000_000, earningsYield: 0.06, volatility: 0.03, properties: ['tk_marunouchi_office', 'tk_odaiba_hotel', 'yk_station_bldg', 'os_umeda_office'], description: '都心の一等地を多く持つ。買収すれば丸の内や台場のビルが手に入る。' },
  { id: 'tsubame_unyu', name: 'つばめ運輸', sector: 'logistics', hq: '名古屋', lat: 35.17, lon: 136.88, baseCap: 900 * OKU, shares: 30_000_000, earningsYield: 0.08, volatility: 0.03, properties: ['os_sakai_logistics'], description: '中部を中心とするトラック運送。' },
  { id: 'wakaba_foods', name: '若葉フーズ', sector: 'food', hq: '大阪', lat: 34.69, lon: 135.5, baseCap: 1200 * OKU, shares: 40_000_000, earningsYield: 0.06, volatility: 0.02, properties: [], description: '加工食品のメーカー。景気に左右されにくい。' },
  { id: 'soukai_kaiun', name: '蒼海海運', sector: 'shipping', hq: '神戸', lat: 34.69, lon: 135.19, baseCap: 1500 * OKU, shares: 50_000_000, earningsYield: 0.09, volatility: 0.07, properties: ['kb_port_warehouse'], description: 'コンテナ船と港湾倉庫。海運市況で株価が大きく動く。' },
  { id: 'momiji_bank', name: '紅葉銀行', sector: 'finance', hq: '福岡・天神', lat: 33.59, lon: 130.4, baseCap: 2500 * OKU, shares: 100_000_000, earningsYield: 0.05, volatility: 0.03, properties: [], description: '九州の地方銀行。配当が安定している。' },
  { id: 'shinonome_heavy', name: '東雲重工', sector: 'heavy', hq: '北九州', lat: 33.87, lon: 130.81, baseCap: 3000 * OKU, shares: 60_000_000, earningsYield: 0.07, volatility: 0.04, properties: [], description: '造船と発電設備の重工業。' },
  { id: 'sakura_air', name: 'サクラ航空', sector: 'airline', hq: '東京・羽田', lat: 35.5494, lon: 139.7798, baseCap: 3500 * OKU, shares: 100_000_000, earningsYield: 0.09, volatility: 0.08, properties: ['tk_haneda_hangar'], description: '国内線中心の航空会社。燃料費と嵐に弱い。' },
  { id: 'hokuto_power', name: '北斗電力', sector: 'energy', hq: '札幌', lat: 43.06, lon: 141.35, baseCap: 5000 * OKU, shares: 200_000_000, earningsYield: 0.05, volatility: 0.02, properties: ['sp_tomakomai_industrial'], description: '北海道の電力会社。堅実で値動きが小さい。' },
  { id: 'hoshikawa_soft', name: '星河ソフト', sector: 'it', hq: '東京・渋谷', lat: 35.659, lon: 139.7, baseCap: 6000 * OKU, shares: 50_000_000, earningsYield: 0.06, volatility: 0.07, properties: ['tk_shibuya_office'], description: '成長中のソフトウェア会社。成長方針で伸びる。' },
  { id: 'youkou_semi', name: '陽光半導体', sector: 'semiconductor', hq: '熊本', lat: 32.8, lon: 130.71, baseCap: 2 * CHO, shares: 500_000_000, earningsYield: 0.08, volatility: 0.07, properties: ['km_kikuyo_industrial'], description: '熊本に工場を持つ半導体メーカー。' },
  { id: 'minato_shoji', name: 'ミナト商事', sector: 'trading', hq: '東京・丸の内', lat: 35.68, lon: 139.763, baseCap: 4 * CHO, shares: 1_000_000_000, earningsYield: 0.08, volatility: 0.04, properties: [], description: '資源から食品まで扱う総合商社。' },
  { id: 'nishiki_motors', name: 'ニシキ自動車', sector: 'auto', hq: '浜松', lat: 34.71, lon: 137.73, baseCap: 8 * CHO, shares: 2_000_000_000, earningsYield: 0.07, volatility: 0.04, properties: ['hm_auto_plant'], description: '日本を代表する自動車メーカー（架空）。' },
  // ---- 世界 ----
  { id: 'southern_cross_agri', name: 'Southern Cross Agri', sector: 'agri', hq: 'シドニー', lat: -33.87, lon: 151.21, baseCap: 800 * OKU, shares: 40_000_000, earningsYield: 0.06, volatility: 0.03, properties: ['au_outback_station'], description: '豪州の農業・畜産会社。' },
  { id: 'rio_verde_agro', name: 'Rio Verde Agro', sector: 'agri', hq: 'サンパウロ', lat: -23.55, lon: -46.63, baseCap: 600 * OKU, shares: 30_000_000, earningsYield: 0.07, volatility: 0.04, properties: ['mg_farm'], description: 'ブラジルの大豆農場を持つ。' },
  { id: 'pacific_ridge_mining', name: 'Pacific Ridge Mining', sector: 'mining', hq: 'サンティアゴ', lat: -33.45, lon: -70.67, baseCap: 3000 * OKU, shares: 100_000_000, earningsYield: 0.11, volatility: 0.08, properties: ['at_mining_land'], description: 'チリの銅鉱山会社。' },
  { id: 'thames_crown', name: 'Thames & Crown Properties', sector: 'realestate', hq: 'ロンドン', lat: 51.51, lon: -0.12, baseCap: 9000 * OKU, shares: 200_000_000, earningsYield: 0.05, volatility: 0.03, properties: ['ld_mayfair_townhouse', 'ld_city_office'], description: 'ロンドンの一等地を持つ不動産会社。' },
  { id: 'al_sahra_holdings', name: 'Al Sahra Holdings', sector: 'realestate', hq: 'ドバイ', lat: 25.2, lon: 55.27, baseCap: 1.2 * CHO, shares: 400_000_000, earningsYield: 0.07, volatility: 0.06, properties: ['db_downtown_hotel', 'db_palm_villa'], description: 'ドバイの高層ホテルとヴィラを持つ。' },
  { id: 'tan_kim_logistics', name: 'Tan Kim Logistics', sector: 'shipping', hq: 'シンガポール', lat: 1.29, lon: 103.85, baseCap: 1.5 * CHO, shares: 500_000_000, earningsYield: 0.08, volatility: 0.04, properties: ['sg_jurong_factory'], description: '東南アジアの港湾・物流。' },
  { id: 'nordlicht_energie', name: 'Nordlicht Energie', sector: 'energy', hq: 'ベルリン', lat: 52.52, lon: 13.4, baseCap: 2 * CHO, shares: 500_000_000, earningsYield: 0.05, volatility: 0.03, properties: ['bl_mitte_office'], description: '風力・太陽光を中心とする電力会社。' },
  { id: 'huanghe_steel', name: '黄河鋼鉄', sector: 'steel', hq: '上海', lat: 31.23, lon: 121.47, baseCap: 2 * CHO, shares: 1_000_000_000, earningsYield: 0.06, volatility: 0.05, properties: [], description: '世界最大級の製鉄会社（架空）。' },
  { id: 'ganges_motors', name: 'Ganges Motors', sector: 'auto', hq: 'ムンバイ', lat: 19.08, lon: 72.88, baseCap: 1.5 * CHO, shares: 500_000_000, earningsYield: 0.08, volatility: 0.06, properties: [], description: 'インドの自動車メーカー。成長市場。' },
  { id: 'hudson_realty', name: 'Hudson Realty Group', sector: 'realestate', hq: 'ニューヨーク', lat: 40.75, lon: -73.98, baseCap: 4 * CHO, shares: 1_000_000_000, earningsYield: 0.05, volatility: 0.04, properties: ['ny_fifth_ave_retail', 'ny_midtown_office', 'ny_brooklyn_warehouse'], description: 'マンハッタンのビルを持つ不動産会社。' },
  { id: 'nimbus_compute', name: 'Nimbus Compute', sector: 'it', hq: 'サンフランシスコ', lat: 37.78, lon: -122.4, baseCap: 12 * CHO, shares: 2_000_000_000, earningsYield: 0.05, volatility: 0.06, properties: ['sf_soma_office'], description: 'クラウドとAIの巨大IT企業。' },
  { id: 'jade_peak_semi', name: 'Jade Peak Semiconductor', sector: 'semiconductor', hq: '新竹', lat: 24.78, lon: 121.01, baseCap: 20 * CHO, shares: 8_000_000_000, earningsYield: 0.07, volatility: 0.05, properties: ['tp_hsinchu_fab'], description: '世界最大の半導体受託製造（架空）。買収は最終目標。' },
] as const satisfies readonly CompanyDef[];

export type CompanyId = (typeof COMPANIES)[number]['id'];
export const COMPANY_MAP: Record<CompanyId, CompanyDef> = Object.fromEntries(COMPANIES.map((c) => [c.id, c])) as unknown as Record<CompanyId, CompanyDef>;

export function isCompanyId(id: string): id is CompanyId {
  return id in COMPANY_MAP;
}

/** 方針。配当の割合と、残りを再投資したときの成長の違い */
export type CompanyPolicy = 'dividend' | 'balanced' | 'growth';

export const POLICY_DEF: Record<CompanyPolicy, { label: string; payout: number; description: string }> = {
  dividend: { label: '高配当', payout: 0.9, description: '利益の90%を配当にする。成長はほとんどしない。' },
  balanced: { label: 'バランス', payout: 0.5, description: '利益の半分を配当、半分を再投資。' },
  growth: { label: '成長重視', payout: 0.2, description: '利益の80%を再投資して事業を伸ばす。配当は少ないが株価が上がる。' },
};

/** 経営権に必要な持株比率（3分の2） */
export const CONTROL_RATIO = 2 / 3;
