/**
 * 事業（じぶんで始める会社・お店）。
 *
 * 資源を掘って売るだけでなく、
 *  - 個人経営のお店（仕入れて並べて売る。人件費・知名度・駐車場が効く）
 *  - 知識でお金にする会社（IT・パソコン・ゲーム・アプリ・広告代理）
 * を自分の土地に構えて育てられる。どれも研究ツリーで解放する。
 */
import type { ResourceId } from './resources';

/** 事業の種類 */
export type BusinessKindId =
  // 売る（お店）
  | 'shop' | 'restaurant' | 'jewelry' | 'convenience' | 'apparel' | 'hotel' | 'casino'
  // つくる（工業）
  | 'pc' | 'automaker' | 'appliance' | 'pharma' | 'foodmaker' | 'shipyard' | 'aerospace'
  // 情報・娯楽
  | 'it' | 'game' | 'app' | 'media' | 'agency' | 'music'
  // 運ぶ・建てる
  | 'transport' | 'railway' | 'airline' | 'construction' | 'realestate'
  // 金融・サービス
  | 'bank' | 'securities' | 'insurance' | 'clinic' | 'school' | 'staffing' | 'security'
  // 掘る
  | 'prospecting';

/** 業種の系統（一覧をまとめて見せるため） */
export type BusinessSector = 'retail' | 'industry' | 'info' | 'logistics' | 'finance' | 'mining';

export const SECTOR_LABEL: Record<BusinessSector, string> = {
  retail: '売る（お店）',
  industry: 'つくる（工業）',
  info: '情報・娯楽',
  logistics: '運ぶ・建てる',
  finance: '金融・サービス',
  mining: '掘る（探鉱）',
};

/** 店か、案件をこなす会社か */
export type BusinessStyle = 'shop' | 'studio' | 'mine';

export interface BusinessDef {
  id: BusinessKindId;
  name: string;
  icon: string;
  style: BusinessStyle;
  /** 系統（一覧の並べ方） */
  sector: BusinessSector;
  /** 解放に必要な研究 */
  research: string;
  /** 開業にかかるお金（円） */
  setupCost: number;
  /** 従業員1人あたりの月給ではなく、毎秒の人件費（円/秒） */
  wagePerStaff: number;
  /** 最初に雇う人数 */
  initialStaff: number;
  /** 雇える人数の上限 */
  maxStaff: number;
  /** 従業員1人あたりの仕事量（店なら接客、会社なら開発力） */
  outputPerStaff: number;
  /** 店が扱う商品（この中から仕入れて売る） */
  goods?: ResourceId[];
  description: string;
  /** どんな場所に構えるとよいか（表示用） */
  placeHint: string;
}

export const BUSINESSES = [
  {
    id: 'shop',
    name: '個人商店',
    icon: 'icon_commercial_shop',
    style: 'shop',
    sector: 'retail',
    research: 'retail',
    setupCost: 300000,
    wagePerStaff: 0.35,
    initialStaff: 1,
    maxStaff: 30,
    outputPerStaff: 1,
    goods: ['food', 'clothing', 'tool', 'furniture', 'paper', 'plastic', 'glass', 'battery', 'electronics'],
    description: '自分の店を開いて、仕入れた品物を並べて売る。人通りと知名度で客足が決まり、駐車場があると遠くからも来てくれる。',
    placeHint: '人の多い街なかの店舗・商業区画ほど客が来る',
  },
  {
    id: 'restaurant',
    name: '飲食店',
    icon: 'icon_commercial_restaurant',
    style: 'shop',
    sector: 'retail',
    research: 'food_service',
    setupCost: 800000,
    wagePerStaff: 0.45,
    initialStaff: 2,
    maxStaff: 40,
    outputPerStaff: 1,
    goods: ['food', 'water', 'wheat'],
    description: '料理を出す店。仕入れた食材がそのまま料理になる。回転が速く、知名度がそのまま客足になる。',
    placeHint: '駅前や繁華街ほど回転する',
  },
  {
    id: 'convenience',
    name: 'コンビニ・スーパー',
    icon: 'icon_commercial_supermarket',
    style: 'shop',
    sector: 'retail',
    research: 'chain_retail',
    setupCost: 5000000,
    wagePerStaff: 0.4,
    initialStaff: 4,
    maxStaff: 120,
    outputPerStaff: 1,
    goods: ['food', 'water', 'clothing', 'paper', 'plastic', 'battery', 'tool'],
    description: '品数で勝負する店。客単価は低いが、朝から晩まで途切れずに売れる。',
    placeHint: '住宅地でも幹線道路沿いでも客が付く',
  },
  {
    id: 'apparel',
    name: 'アパレル店',
    icon: 'icon_facility_textile_factory',
    style: 'shop',
    sector: 'retail',
    research: 'fashion',
    setupCost: 3000000,
    wagePerStaff: 0.42,
    initialStaff: 3,
    maxStaff: 60,
    outputPerStaff: 1,
    goods: ['clothing', 'cloth', 'leather'],
    description: '服を売る店。ブランド価値がそのまま値札に乗る商売。',
    placeHint: '街なかの一等地ほど高く売れる',
  },
  {
    id: 'jewelry',
    name: '宝石店',
    icon: 'icon_resource_gem',
    style: 'shop',
    sector: 'retail',
    research: 'gemology',
    setupCost: 12000000,
    wagePerStaff: 0.6,
    initialStaff: 3,
    maxStaff: 50,
    outputPerStaff: 1,
    goods: ['gem', 'gold', 'silver'],
    description: '宝石と貴金属を扱う。1点の値段が桁違いで、ブランドが命。自分で掘った金や宝石をそのまま並べられる。',
    placeHint: '一等地ほど高く売れる',
  },
  {
    id: 'hotel',
    name: 'ホテル',
    icon: 'icon_commercial_hotel',
    style: 'shop',
    sector: 'retail',
    research: 'hospitality',
    setupCost: 60000000,
    wagePerStaff: 0.7,
    initialStaff: 10,
    maxStaff: 300,
    outputPerStaff: 1,
    goods: ['food', 'water', 'cloth', 'clothing'],
    description: '泊まってもらう商売。立地と知名度で埋まり具合が決まる。',
    placeHint: '観光地と都心が向いている',
  },
  {
    id: 'casino',
    name: 'カジノ',
    icon: 'icon_ui_star',
    style: 'shop',
    sector: 'retail',
    research: 'gaming_license',
    setupCost: 300000000,
    wagePerStaff: 1.2,
    initialStaff: 20,
    maxStaff: 400,
    outputPerStaff: 1,
    goods: ['food', 'water'],
    description: '賭場を開く。客が落としていく額は大きいが、規制も評判も重い。',
    placeHint: '観光地・リゾートに限る',
  },
  {
    id: 'foodmaker',
    name: '食品メーカー',
    icon: 'icon_facility_food_factory',
    style: 'studio',
    sector: 'industry',
    research: 'food_industry',
    setupCost: 6000000,
    wagePerStaff: 0.9,
    initialStaff: 5,
    maxStaff: 300,
    outputPerStaff: 1,
    description: '加工食品を開発して売る。当たると全国のお店に並ぶ。',
    placeHint: '工場のそばが向いている',
  },
  {
    id: 'appliance',
    name: '家電メーカー',
    icon: 'icon_material_electronics',
    style: 'studio',
    sector: 'industry',
    research: 'appliances',
    setupCost: 10000000,
    wagePerStaff: 1.3,
    initialStaff: 4,
    maxStaff: 300,
    outputPerStaff: 1,
    description: '冷蔵庫やテレビを作る。部品を自社で作れると利益が残る。',
    placeHint: '工場が向いている',
  },
  {
    id: 'pc',
    name: 'パソコン製造',
    icon: 'icon_material_semiconductor',
    style: 'studio',
    sector: 'industry',
    research: 'pc_maker',
    setupCost: 8000000,
    wagePerStaff: 1.6,
    initialStaff: 3,
    maxStaff: 300,
    outputPerStaff: 1,
    description: '新しい素材や設計を試して、安い機種・速い機種を作って発売する。部品は自社の工場から回せる。',
    placeHint: '工場や倉庫に構えると部品を回しやすい',
  },
  {
    id: 'automaker',
    name: '自動車メーカー',
    icon: 'icon_facility_vehicle_factory',
    style: 'studio',
    sector: 'industry',
    research: 'car_maker',
    setupCost: 80000000,
    wagePerStaff: 1.7,
    initialStaff: 10,
    maxStaff: 600,
    outputPerStaff: 1,
    description: '車を開発して売る。桁の大きい商売で、素材・部品・物流のすべてが要る。',
    placeHint: '大きな工場用地が要る',
  },
  {
    id: 'pharma',
    name: '製薬会社',
    icon: 'icon_facility_chemical_plant',
    style: 'studio',
    sector: 'industry',
    research: 'pharmaceutics',
    setupCost: 50000000,
    wagePerStaff: 2.4,
    initialStaff: 6,
    maxStaff: 400,
    outputPerStaff: 1,
    description: '薬を開発する。時間はかかるが、通れば長く売れ続ける。',
    placeHint: '研究所のある土地が向いている',
  },
  {
    id: 'shipyard',
    name: '造船所',
    icon: 'icon_logistics_ship',
    style: 'studio',
    sector: 'industry',
    research: 'shipbuilding',
    setupCost: 120000000,
    wagePerStaff: 1.6,
    initialStaff: 15,
    maxStaff: 500,
    outputPerStaff: 1,
    description: '船を建造する。1隻の額が大きく、鋼材を大量に使う。',
    placeHint: '港のある海沿いが向いている',
  },
  {
    id: 'aerospace',
    name: '航空機メーカー',
    icon: 'icon_logistics_airplane',
    style: 'studio',
    sector: 'industry',
    research: 'aerospace',
    setupCost: 400000000,
    wagePerStaff: 2.6,
    initialStaff: 20,
    maxStaff: 800,
    outputPerStaff: 1,
    description: '旅客機や部品を作る。最も難しく、最も単価が高い。',
    placeHint: '広い工場用地と空港が要る',
  },
  {
    id: 'it',
    name: 'IT会社',
    icon: 'icon_office_dashboard',
    style: 'studio',
    sector: 'info',
    research: 'software',
    setupCost: 2000000,
    wagePerStaff: 1.2,
    initialStaff: 2,
    maxStaff: 200,
    outputPerStaff: 1,
    description: 'セキュリティソフトやホームページ、社内システムを請け負う。実績が増えるほど大きな案件が来る。',
    placeHint: 'オフィスビルに構えると採用が進みやすい',
  },
  {
    id: 'game',
    name: 'ゲーム会社',
    icon: 'icon_ui_star',
    style: 'studio',
    sector: 'info',
    research: 'game_dev',
    setupCost: 3000000,
    wagePerStaff: 1.3,
    initialStaff: 2,
    maxStaff: 200,
    outputPerStaff: 1,
    description: '企画を立てて作り、出したあとも運営して遊ばれ続ける。当たると長く稼ぐが、飽きられると落ちていく。',
    placeHint: 'オフィスでもアパートの一室でも始められる',
  },
  {
    id: 'app',
    name: 'アプリ会社',
    icon: 'icon_ui_company',
    style: 'studio',
    sector: 'info',
    research: 'mobile',
    setupCost: 2500000,
    wagePerStaff: 1.25,
    initialStaff: 2,
    maxStaff: 200,
    outputPerStaff: 1,
    description: 'SNS や便利アプリを作る。利用者が増えるほど自然に広まり、知名度そのものが資産になる。',
    placeHint: 'どこでも始められる',
  },
  {
    id: 'media',
    name: 'メディア会社',
    icon: 'icon_ui_star',
    style: 'studio',
    sector: 'info',
    research: 'mass_media',
    setupCost: 15000000,
    wagePerStaff: 1.5,
    initialStaff: 5,
    maxStaff: 250,
    outputPerStaff: 1,
    description: '番組や記事を作って流す。自社の知名度が上がりやすくなり、広告の効きもよくなる。',
    placeHint: '都心のオフィスが向いている',
  },
  {
    id: 'agency',
    name: '広告代理店',
    icon: 'icon_ui_chart_trend',
    style: 'studio',
    sector: 'info',
    research: 'advertising',
    setupCost: 5000000,
    wagePerStaff: 1.4,
    initialStaff: 3,
    maxStaff: 150,
    outputPerStaff: 1,
    description: '他社の広告を請け負う。自社の広告費が安くなり、持っている土地に看板を立てて貸せるようになる。',
    placeHint: '街なかのオフィスが向いている',
  },
  {
    id: 'music',
    name: '音楽・映像',
    icon: 'icon_ui_star',
    style: 'studio',
    sector: 'info',
    research: 'entertainment',
    setupCost: 8000000,
    wagePerStaff: 1.3,
    initialStaff: 4,
    maxStaff: 200,
    outputPerStaff: 1,
    description: '音楽や映像を作って届ける。当たれば知名度が跳ね上がる。',
    placeHint: 'スタジオを置ける建物が要る',
  },
  {
    id: 'transport',
    name: '運送会社',
    icon: 'icon_logistics_truck',
    style: 'studio',
    sector: 'logistics',
    research: 'freight_business',
    setupCost: 4000000,
    wagePerStaff: 0.9,
    initialStaff: 4,
    maxStaff: 300,
    outputPerStaff: 1,
    description: 'よその会社の荷物を運ぶ。自社の輸送費が下がり、請け負った路線からは毎日お金が入る。',
    placeHint: '倉庫や工場のそばが向いている',
  },
  {
    id: 'railway',
    name: '鉄道会社',
    icon: 'icon_logistics_train',
    style: 'studio',
    sector: 'logistics',
    research: 'rail_business',
    setupCost: 200000000,
    wagePerStaff: 1.2,
    initialStaff: 30,
    maxStaff: 800,
    outputPerStaff: 1,
    description: '路線を持って人と荷物を運ぶ。初期費用は重いが、いったん開通すれば長く稼ぐ。',
    placeHint: '駅を置ける土地が要る',
  },
  {
    id: 'airline',
    name: '航空会社',
    icon: 'icon_logistics_airplane',
    style: 'studio',
    sector: 'logistics',
    research: 'airline_business',
    setupCost: 500000000,
    wagePerStaff: 1.8,
    initialStaff: 40,
    maxStaff: 900,
    outputPerStaff: 1,
    description: '路線を開いて飛ばす。景気と燃料に大きく振られる商売。',
    placeHint: '空港のそばが要る',
  },
  {
    id: 'construction',
    name: '建設会社',
    icon: 'icon_machine_tower_crane',
    style: 'studio',
    sector: 'logistics',
    research: 'construction_business',
    setupCost: 6000000,
    wagePerStaff: 1.1,
    initialStaff: 5,
    maxStaff: 400,
    outputPerStaff: 1,
    description: '家やビル、道路や橋を建てる。材料を自社から回せるので、素材産業とつながると強い。',
    placeHint: '資材置き場のある広い土地が向いている',
  },
  {
    id: 'realestate',
    name: '不動産会社',
    icon: 'icon_commercial_office',
    style: 'studio',
    sector: 'logistics',
    research: 'realestate_business',
    setupCost: 30000000,
    wagePerStaff: 1.3,
    initialStaff: 6,
    maxStaff: 300,
    outputPerStaff: 1,
    description: '土地と建物を扱う。自分が持っている物件の賃料が上がり、仲介の手数料も入る。',
    placeHint: '街なかのオフィスが向いている',
  },
  {
    id: 'bank',
    name: '銀行',
    icon: 'icon_office_coins',
    style: 'studio',
    sector: 'finance',
    research: 'banking',
    setupCost: 50000000,
    wagePerStaff: 1.8,
    initialStaff: 8,
    maxStaff: 500,
    outputPerStaff: 1,
    description: 'お金を預かって貸す。融資の残高から利息が入り続け、信用があるほど大きく貸せる。',
    placeHint: '一等地のオフィスほど信用がつく',
  },
  {
    id: 'securities',
    name: '証券会社',
    icon: 'icon_ui_chart_trend',
    style: 'studio',
    sector: 'finance',
    research: 'securities_business',
    setupCost: 80000000,
    wagePerStaff: 2.0,
    initialStaff: 8,
    maxStaff: 400,
    outputPerStaff: 1,
    description: '株の売買を取り次ぐ。相場が動くほど手数料が入る。',
    placeHint: '金融街のオフィスが向いている',
  },
  {
    id: 'insurance',
    name: '保険会社',
    icon: 'icon_office_documents',
    style: 'studio',
    sector: 'finance',
    research: 'insurance_business',
    setupCost: 100000000,
    wagePerStaff: 1.6,
    initialStaff: 10,
    maxStaff: 500,
    outputPerStaff: 1,
    description: '万一に備える商品を売る。契約が積み上がるほど安定する。',
    placeHint: '都心のオフィスが向いている',
  },
  {
    id: 'clinic',
    name: '医療法人',
    icon: 'icon_ui_medal',
    style: 'studio',
    sector: 'finance',
    research: 'healthcare',
    setupCost: 20000000,
    wagePerStaff: 2.2,
    initialStaff: 6,
    maxStaff: 300,
    outputPerStaff: 1,
    description: '診療所や病院を開く。地域に必要とされるので客足が安定し、ブランドが上がりやすい。',
    placeHint: '住宅の多い街なかが向いている',
  },
  {
    id: 'school',
    name: '教育事業',
    icon: 'icon_ui_research',
    style: 'studio',
    sector: 'finance',
    research: 'education',
    setupCost: 10000000,
    wagePerStaff: 1.2,
    initialStaff: 4,
    maxStaff: 200,
    outputPerStaff: 1,
    description: '塾や専門学校をつくる。授業料が入るうえ、研究ポイントが増えやすくなる。',
    placeHint: '通いやすい街なかが向いている',
  },
  {
    id: 'staffing',
    name: '人材サービス',
    icon: 'icon_facility_worker',
    style: 'studio',
    sector: 'finance',
    research: 'staffing_business',
    setupCost: 8000000,
    wagePerStaff: 1.0,
    initialStaff: 4,
    maxStaff: 300,
    outputPerStaff: 1,
    description: '人を集めて送り出す。自社の人件費も下げられるようになる。',
    placeHint: '駅前のオフィスが向いている',
  },
  {
    id: 'security',
    name: '警備会社',
    icon: 'icon_ui_lock',
    style: 'studio',
    sector: 'finance',
    research: 'security_business',
    setupCost: 6000000,
    wagePerStaff: 0.8,
    initialStaff: 6,
    maxStaff: 400,
    outputPerStaff: 1,
    description: '施設や現場を守る。地味だが切れ目なく仕事がある。',
    placeHint: 'どこでも始められる',
  },
  {
    id: 'prospecting',
    name: '探鉱・金採掘',
    icon: 'icon_machine_drilling_rig',
    style: 'mine',
    sector: 'mining',
    research: 'gold_rush',
    setupCost: 1_500_000,
    wagePerStaff: 0.5,
    initialStaff: 3,
    maxStaff: 500,
    outputPerStaff: 1,
    description: '鉱区を構えて、そこに埋まっているものを掘り出す。金や宝石の鉱脈に当たれば一攫千金、外れれば人件費だけが出ていく。掘り尽くすと枯れる。',
    placeHint: '調査で金・銀・宝石が見つかった土地ほど当たりが大きい',
  },
] as const satisfies readonly BusinessDef[];

export const BUSINESS_MAP: Record<BusinessKindId, BusinessDef> = Object.fromEntries(BUSINESSES.map((b) => [b.id, b])) as unknown as Record<BusinessKindId, BusinessDef>;

export function isBusinessKind(id: string): id is BusinessKindId {
  return id in BUSINESS_MAP;
}

/** 知名度の段階（表示用） */
export const AWARENESS_TIERS: readonly { min: number; label: string }[] = [
  { min: 0, label: '知られていない' },
  { min: 15, label: '近所で知られている' },
  { min: 35, label: '街で知られている' },
  { min: 60, label: '地域で有名' },
  { min: 80, label: '全国区' },
  { min: 95, label: '誰もが知っている' },
];

export function awarenessLabel(v: number): string {
  let label = AWARENESS_TIERS[0].label;
  for (const t of AWARENESS_TIERS) if (v >= t.min) label = t.label;
  return label;
}

/** ブランド価値の段階（表示用） */
export const BRAND_TIERS: readonly { min: number; label: string }[] = [
  { min: 0, label: '無印' },
  { min: 20, label: '評判はまずまず' },
  { min: 45, label: '信頼されている' },
  { min: 70, label: '憧れのブランド' },
  { min: 90, label: '別格' },
];

export function brandLabel(v: number): string {
  let label = BRAND_TIERS[0].label;
  for (const t of BRAND_TIERS) if (v >= t.min) label = t.label;
  return label;
}

/** 広告の種類 */
export interface AdDef {
  id: string;
  name: string;
  icon: string;
  /** 解放に必要な研究（なければ最初から） */
  research?: string;
  /** 毎秒かかる費用（円/秒） */
  costPerSec: number;
  /** 毎秒上がる知名度 */
  awarenessPerSec: number;
  /** 知名度がこれ以上には上がらない（その広告だけでは頭打ちになる） */
  cap: number;
  /** 契約の長さ（秒） */
  duration: number;
  description: string;
}

export const ADS = [
  { id: 'flyer', name: 'チラシ配り', icon: 'icon_office_documents', costPerSec: 2, awarenessPerSec: 0.05, cap: 30, duration: 600, description: '近所に配る。安いが、届く範囲はせまい。' },
  { id: 'web', name: 'ネット広告', icon: 'icon_office_dashboard', research: 'advertising', costPerSec: 20, awarenessPerSec: 0.12, cap: 55, duration: 900, description: '検索やSNSに出す。費用のわりに広く届く。' },
  { id: 'billboard', name: '屋外看板', icon: 'icon_ui_location', research: 'outdoor_ads', costPerSec: 60, awarenessPerSec: 0.2, cap: 75, duration: 1800, description: '自分の土地に看板を立てる。置ける場所が要る。' },
  { id: 'tv', name: 'テレビCM', icon: 'icon_ui_star', research: 'mass_media', costPerSec: 400, awarenessPerSec: 0.45, cap: 95, duration: 1200, description: '一気に全国区へ。費用は桁違い。' },
] as const satisfies readonly AdDef[];

export const AD_MAP: Record<string, AdDef> = Object.fromEntries(ADS.map((a) => [a.id, a]));

/** 駐車場1台あたりに必要な面積（㎡） */
export const SQM_PER_PARKING = 25;
/** 客が1人来ると、何台ぶんの駐車場が要るか（歩きや電車の客もいるので1未満） */
export const PARKING_PER_CUSTOMER = 0.08;
