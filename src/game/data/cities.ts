/**
 * 不動産・会社が置かれる都市（実在の場所）。
 * trend は地価の基本トレンド（1時間あたりの上昇率）、volatility は変動の大きさ。
 * どちらも「ゲーム内で成立する値」であって、現実の予測ではない。
 */
export interface CityDef {
  id: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  /** 地価の基本トレンド（1時間あたり。0.015 = +1.5%/時） */
  trend: number;
  /** 1時間あたりの価格のぶれ（標準偏差） */
  volatility: number;
}

export const CITIES = [
  // ---- 日本 ----
  { id: 'tokyo', name: '東京', country: '日本', lat: 35.6812, lon: 139.7671, trend: 0.015, volatility: 0.02 },
  { id: 'yokohama', name: '横浜', country: '日本', lat: 35.4658, lon: 139.622, trend: 0.012, volatility: 0.02 },
  { id: 'osaka', name: '大阪', country: '日本', lat: 34.7025, lon: 135.4959, trend: 0.013, volatility: 0.025 },
  { id: 'kyoto', name: '京都', country: '日本', lat: 35.0038, lon: 135.769, trend: 0.011, volatility: 0.02 },
  { id: 'kobe', name: '神戸', country: '日本', lat: 34.695, lon: 135.195, trend: 0.006, volatility: 0.02 },
  { id: 'nagoya', name: '名古屋', country: '日本', lat: 35.1709, lon: 136.8815, trend: 0.009, volatility: 0.02 },
  { id: 'fukuoka', name: '福岡', country: '日本', lat: 33.5904, lon: 130.4017, trend: 0.016, volatility: 0.025 },
  { id: 'iizuka', name: '飯塚・嘉穂', country: '日本', lat: 33.6459, lon: 130.6915, trend: 0.002, volatility: 0.015 },
  { id: 'kumamoto', name: '熊本', country: '日本', lat: 32.869, lon: 130.83, trend: 0.014, volatility: 0.03 },
  { id: 'sapporo', name: '札幌', country: '日本', lat: 43.06, lon: 141.354, trend: 0.011, volatility: 0.02 },
  { id: 'niseko', name: 'ニセコ', country: '日本', lat: 42.862, lon: 140.687, trend: 0.02, volatility: 0.04 },
  { id: 'hokkaido_rural', name: '北海道（郊外）', country: '日本', lat: 43.3, lon: 143.5, trend: -0.002, volatility: 0.015 },
  { id: 'sendai', name: '仙台', country: '日本', lat: 38.26, lon: 140.882, trend: 0.006, volatility: 0.02 },
  { id: 'hiroshima', name: '広島', country: '日本', lat: 34.395, lon: 132.457, trend: 0.005, volatility: 0.02 },
  { id: 'okinawa', name: '沖縄', country: '日本', lat: 26.215, lon: 127.687, trend: 0.014, volatility: 0.03 },
  { id: 'nagano', name: '軽井沢・白馬', country: '日本', lat: 36.5, lon: 138.2, trend: 0.012, volatility: 0.03 },
  { id: 'hamamatsu', name: '浜松', country: '日本', lat: 34.7108, lon: 137.7261, trend: 0.004, volatility: 0.015 },
  // ---- 世界 ----
  { id: 'new_york', name: 'ニューヨーク', country: 'アメリカ', lat: 40.7128, lon: -74.006, trend: 0.01, volatility: 0.03 },
  { id: 'san_francisco', name: 'サンフランシスコ', country: 'アメリカ', lat: 37.7749, lon: -122.4194, trend: 0.008, volatility: 0.035 },
  { id: 'texas', name: 'テキサス', country: 'アメリカ', lat: 31.0, lon: -100.0, trend: 0.013, volatility: 0.02 },
  { id: 'hawaii', name: 'ハワイ', country: 'アメリカ', lat: 21.3069, lon: -157.8583, trend: 0.01, volatility: 0.025 },
  { id: 'toronto', name: 'トロント', country: 'カナダ', lat: 43.6532, lon: -79.3832, trend: 0.006, volatility: 0.025 },
  { id: 'london', name: 'ロンドン', country: 'イギリス', lat: 51.5074, lon: -0.1278, trend: 0.008, volatility: 0.025 },
  { id: 'paris', name: 'パリ', country: 'フランス', lat: 48.8566, lon: 2.3522, trend: 0.006, volatility: 0.02 },
  { id: 'berlin', name: 'ベルリン', country: 'ドイツ', lat: 52.52, lon: 13.405, trend: 0.007, volatility: 0.02 },
  { id: 'singapore', name: 'シンガポール', country: 'シンガポール', lat: 1.3521, lon: 103.8198, trend: 0.012, volatility: 0.02 },
  { id: 'hong_kong', name: '香港', country: '香港', lat: 22.3193, lon: 114.1694, trend: 0.002, volatility: 0.035 },
  { id: 'shanghai', name: '上海', country: '中国', lat: 31.2304, lon: 121.4737, trend: 0.003, volatility: 0.03 },
  { id: 'seoul', name: 'ソウル', country: '韓国', lat: 37.5665, lon: 126.978, trend: 0.01, volatility: 0.025 },
  { id: 'taipei', name: '台北・新竹', country: '台湾', lat: 25.033, lon: 121.5654, trend: 0.011, volatility: 0.025 },
  { id: 'dubai', name: 'ドバイ', country: 'UAE', lat: 25.2048, lon: 55.2708, trend: 0.02, volatility: 0.045 },
  { id: 'sydney', name: 'シドニー', country: 'オーストラリア', lat: -33.8688, lon: 151.2093, trend: 0.01, volatility: 0.02 },
  { id: 'outback', name: '豪州内陸', country: 'オーストラリア', lat: -23.44, lon: 144.25, trend: 0.001, volatility: 0.015 },
  { id: 'bangkok', name: 'バンコク', country: 'タイ', lat: 13.7563, lon: 100.5018, trend: 0.009, volatility: 0.03 },
  { id: 'mumbai', name: 'ムンバイ', country: 'インド', lat: 19.076, lon: 72.8777, trend: 0.017, volatility: 0.035 },
  { id: 'sao_paulo', name: 'サンパウロ', country: 'ブラジル', lat: -23.5505, lon: -46.6333, trend: 0.008, volatility: 0.035 },
  { id: 'mato_grosso', name: 'マットグロッソ', country: 'ブラジル', lat: -12.545, lon: -55.721, trend: 0.009, volatility: 0.025 },
  { id: 'atacama', name: 'アタカマ', country: 'チリ', lat: -22.46, lon: -68.93, trend: 0.004, volatility: 0.03 },
] as const satisfies readonly CityDef[];

export type CityId = (typeof CITIES)[number]['id'];
export const CITY_MAP: Record<CityId, CityDef> = Object.fromEntries(CITIES.map((c) => [c.id, c])) as unknown as Record<CityId, CityDef>;

export function isCityId(id: string): id is CityId {
  return id in CITY_MAP;
}
