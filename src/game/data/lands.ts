import type { ResourceId } from './resources';
import type { TerrainId } from './terrain';
import type { UnlockCondition } from './unlockTypes';

export type CountryCode = 'JP' | 'US' | 'AU' | 'CL' | 'CN' | 'SA' | 'DE' | 'CA' | 'NO' | 'BR';

export const COUNTRY_NAME: Record<CountryCode, string> = {
  JP: '日本',
  US: 'アメリカ',
  AU: 'オーストラリア',
  CL: 'チリ',
  CN: '中国',
  SA: 'サウジアラビア',
  DE: 'ドイツ',
  CA: 'カナダ',
  NO: 'ノルウェー',
  BR: 'ブラジル',
};

export const COUNTRY_ORDER: CountryCode[] = ['JP', 'US', 'CN', 'DE', 'NO', 'AU', 'CL', 'BR', 'SA', 'CA'];

/**
 * 購入できる土地の定義。実在地域を参考にしたゲーム用の値で、現実の数値ではない。
 * deposits は基準の埋蔵量。購入時に ±20% ばらつく。
 */
export interface LandDef {
  id: string;
  name: string;
  nameEn: string;
  country: CountryCode;
  region: string;
  terrain: TerrainId;
  /** 購入価格（円） */
  price: number;
  /** 人口・交通量の係数（商業施設の収益に掛かる） */
  population: number;
  deposits: Partial<Record<ResourceId, number>>;
  description: string;
  unlock: UnlockCondition;
}

export const HQ_LAND_ID = 'hq';

export const LANDS = [
  {
    id: 'jp_hokkaido', name: '北海道・十勝', nameEn: 'Tokachi, Hokkaido', country: 'JP', region: '北海道', terrain: 'plains', price: 300_000, population: 0.3,
    deposits: { coal: 120_000 },
    description: '広い平原。農園に最適で、小さな炭鉱もある。最初の土地に向く。',
    unlock: { type: 'always' },
  },
  {
    id: 'jp_chikuho', name: '九州・筑豊', nameEn: 'Chikuho, Kyushu', country: 'JP', region: '福岡', terrain: 'mountain', price: 600_000, population: 0.6,
    deposits: { coal: 400_000, iron_ore: 150_000 },
    description: '山あいの炭田地帯。石炭と鉄鉱石の両方が採れる。',
    unlock: { type: 'always' },
  },
  {
    id: 'jp_tokyo', name: '東京湾岸', nameEn: 'Tokyo Bay', country: 'JP', region: '東京', terrain: 'city', price: 8_000_000, population: 3,
    deposits: {},
    description: '人口と交通量が圧倒的。商業施設の収益が高く、港もある。',
    unlock: { type: 'assets', min: 5_000_000 },
  },
  {
    id: 'no_vestland', name: 'ノルウェー西部', nameEn: 'Vestland, Norway', country: 'NO', region: 'ヴェストラン', terrain: 'river', price: 5_000_000, population: 0.3,
    deposits: {},
    description: 'フィヨルドと急流。水力発電に最適で、電力を安く大量に作れる。',
    unlock: { type: 'research', research: 'overseas' },
  },
  {
    id: 'us_mesabi', name: 'ミネソタ・メサビ', nameEn: 'Mesabi Range, Minnesota', country: 'US', region: 'ミネソタ', terrain: 'forest', price: 3_000_000, population: 0.3,
    deposits: { iron_ore: 3_000_000 },
    description: '巨大な鉄鉱床と広い森林。鉄と木材の一大拠点になる。',
    unlock: { type: 'research', research: 'overseas' },
  },
  {
    id: 'us_texas', name: 'テキサス・パーミアン', nameEn: 'Permian Basin, Texas', country: 'US', region: 'テキサス', terrain: 'desert', price: 4_000_000, population: 0.8,
    deposits: { crude_oil: 2_000_000 },
    description: '大油田と強い日差し。油田と太陽光発電に向く。',
    unlock: { type: 'research', research: 'overseas' },
  },
  {
    id: 'cn_shanxi', name: '山西', nameEn: 'Shanxi', country: 'CN', region: '山西省', terrain: 'mountain', price: 3_500_000, population: 1,
    deposits: { coal: 5_000_000 },
    description: '世界有数の石炭産地。火力発電の燃料に困らない。',
    unlock: { type: 'research', research: 'overseas' },
  },
  {
    id: 'de_ruhr', name: 'ルール工業地帯', nameEn: 'Ruhr, Germany', country: 'DE', region: 'ノルトライン', terrain: 'industrial', price: 10_000_000, population: 2,
    deposits: { coal: 600_000 },
    description: '伝統ある工業地帯。工場と商業の両方に強い。',
    unlock: { type: 'research', research: 'overseas' },
  },
  {
    id: 'cl_atacama', name: 'アタカマ', nameEn: 'Atacama, Chile', country: 'CL', region: 'アントファガスタ', terrain: 'desert', price: 6_000_000, population: 0.2,
    deposits: { copper_ore: 2_500_000 },
    description: '世界最大級の銅鉱床。乾燥した高地で太陽光も強い。',
    unlock: { type: 'research', research: 'overseas' },
  },
  {
    id: 'au_pilbara', name: 'ピルバラ', nameEn: 'Pilbara, Australia', country: 'AU', region: '西オーストラリア', terrain: 'desert', price: 9_000_000, population: 0.1,
    deposits: { iron_ore: 20_000_000 },
    description: '桁違いの鉄鉱石。港から船で大量に運び出せる。',
    unlock: { type: 'all', conditions: [{ type: 'research', research: 'overseas' }, { type: 'assets', min: 20_000_000 }] },
  },
  {
    id: 'br_carajas', name: 'カラジャス', nameEn: 'Carajás, Brazil', country: 'BR', region: 'パラ州', terrain: 'forest', price: 7_000_000, population: 0.4,
    deposits: { iron_ore: 8_000_000, copper_ore: 1_000_000 },
    description: '熱帯林の中の巨大鉱山。鉄と銅、木材が豊富。',
    unlock: { type: 'all', conditions: [{ type: 'research', research: 'overseas' }, { type: 'assets', min: 15_000_000 }] },
  },
  {
    id: 'sa_ghawar', name: 'ガワール', nameEn: 'Ghawar, Saudi Arabia', country: 'SA', region: '東部州', terrain: 'desert', price: 25_000_000, population: 0.3,
    deposits: { crude_oil: 20_000_000 },
    description: '世界最大の油田。パイプラインで原油を運ぶ。',
    unlock: { type: 'all', conditions: [{ type: 'research', research: 'overseas' }, { type: 'assets', min: 50_000_000 }] },
  },
  {
    id: 'au_olympic', name: '南オーストラリア', nameEn: 'South Australia', country: 'AU', region: '南オーストラリア', terrain: 'desert', price: 15_000_000, population: 0.2,
    deposits: { copper_ore: 1_500_000, uranium_ore: 60_000 },
    description: '銅とウランを含む複合鉱床。原子力への入口。',
    unlock: { type: 'all', conditions: [{ type: 'research', research: 'overseas' }, { type: 'assets', min: 30_000_000 }] },
  },
  {
    id: 'ca_athabasca', name: 'アサバスカ', nameEn: 'Athabasca, Canada', country: 'CA', region: 'サスカチュワン', terrain: 'snow', price: 20_000_000, population: 0.1,
    deposits: { uranium_ore: 200_000 },
    description: '高品位のウラン鉱床。寒冷だが原子力燃料の本命。',
    unlock: { type: 'all', conditions: [{ type: 'research', research: 'nuclear' }, { type: 'assets', min: 50_000_000 }] },
  },
] as const satisfies readonly LandDef[];

export type LandDefId = (typeof LANDS)[number]['id'];
export const LAND_MAP: Record<LandDefId, LandDef> = Object.fromEntries(LANDS.map((l) => [l.id, l])) as unknown as Record<LandDefId, LandDef>;

export function isLandDefId(id: string): id is LandDefId {
  return id in LAND_MAP;
}

/** 本社の地形と人口係数 */
export const HQ_TERRAIN: TerrainId = 'industrial';
export const HQ_POPULATION = 1;
