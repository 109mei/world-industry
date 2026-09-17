/**
 * OpenStreetMap のタグを、ゲームの物件の種類に対応づける。
 * OSM のデータは ODbL。実在の建物の形と種類だけを使い、名前は「もじった架空名」にする。
 */
import type { PropertyKind } from './properties';

export type OsmTags = Record<string, string>;

/** 建物の用途を表す日本語ラベル（もじった名前の後ろに添える） */
export interface OsmKindInfo {
  kind: PropertyKind;
  /** 「コンビニ」「駅」「工場」など、何の建物か */
  label: string;
  /** 名前がないときの呼び名 */
  fallbackName: string;
}

const SHOP_LABEL: Record<string, string> = {
  convenience: 'コンビニ',
  supermarket: 'スーパー',
  department_store: '百貨店',
  mall: 'ショッピングモール',
  clothes: '衣料品店',
  electronics: '家電量販店',
  furniture: '家具店',
  hardware: 'ホームセンター',
  doityourself: 'ホームセンター',
  car: '自動車販売店',
  car_repair: '自動車整備',
  bakery: 'パン屋',
  books: '書店',
  chemist: 'ドラッグストア',
  florist: '花屋',
  hairdresser: '美容室',
  jewelry: '宝石店',
  mobile_phone: '携帯ショップ',
  optician: 'めがね店',
  pet: 'ペットショップ',
  shoes: '靴店',
  sports: 'スポーツ用品店',
  toys: 'おもちゃ屋',
  variety_store: '雑貨店',
};

const AMENITY: Record<string, { kind: PropertyKind; label: string }> = {
  restaurant: { kind: 'retail', label: '飲食店' },
  fast_food: { kind: 'retail', label: 'ファストフード' },
  cafe: { kind: 'retail', label: 'カフェ' },
  bar: { kind: 'retail', label: 'バー' },
  pub: { kind: 'retail', label: '居酒屋' },
  bank: { kind: 'office', label: '銀行' },
  pharmacy: { kind: 'retail', label: '薬局' },
  hospital: { kind: 'office', label: '病院' },
  clinic: { kind: 'office', label: '診療所' },
  dentist: { kind: 'office', label: '歯科' },
  school: { kind: 'office', label: '学校' },
  kindergarten: { kind: 'office', label: '幼稚園・保育園' },
  university: { kind: 'office', label: '大学' },
  college: { kind: 'office', label: '専門学校' },
  library: { kind: 'office', label: '図書館' },
  post_office: { kind: 'office', label: '郵便局' },
  police: { kind: 'office', label: '警察署' },
  fire_station: { kind: 'office', label: '消防署' },
  townhall: { kind: 'office', label: '役所' },
  community_centre: { kind: 'office', label: '公民館' },
  cinema: { kind: 'retail', label: '映画館' },
  theatre: { kind: 'retail', label: '劇場' },
  parking: { kind: 'land', label: '駐車場' },
  fuel: { kind: 'retail', label: 'ガソリンスタンド' },
  car_wash: { kind: 'retail', label: '洗車場' },
  place_of_worship: { kind: 'office', label: '寺社・教会' },
  nursing_home: { kind: 'apartment', label: '介護施設' },
  social_facility: { kind: 'office', label: '福祉施設' },
  veterinary: { kind: 'office', label: '動物病院' },
  bus_station: { kind: 'retail', label: 'バスターミナル' },
  marketplace: { kind: 'retail', label: '市場' },
  charging_station: { kind: 'land', label: '充電スタンド' },
  bicycle_parking: { kind: 'land', label: '駐輪場' },
  taxi: { kind: 'land', label: 'タクシー乗り場' },
  recycling: { kind: 'land', label: 'リサイクル施設' },
  waste_transfer_station: { kind: 'warehouse', label: 'ごみ処理施設' },
  prison: { kind: 'office', label: '刑務所' },
  courthouse: { kind: 'office', label: '裁判所' },
  embassy: { kind: 'office', label: '大使館' },
  research_institute: { kind: 'office', label: '研究所' },
  driving_school: { kind: 'office', label: '自動車教習所' },
  events_venue: { kind: 'retail', label: 'イベント会場' },
  conference_centre: { kind: 'office', label: '会議場' },
  casino: { kind: 'retail', label: '遊技場' },
  nightclub: { kind: 'retail', label: 'ナイトクラブ' },
  public_bath: { kind: 'retail', label: '銭湯・温浴施設' },
  funeral_hall: { kind: 'retail', label: '斎場' },
  crematorium: { kind: 'office', label: '斎場' },
  grave_yard: { kind: 'land', label: '墓地' },
  shelter: { kind: 'land', label: '休憩所' },
  toilets: { kind: 'land', label: '公衆トイレ' },
  fountain: { kind: 'land', label: '噴水' },
};

/** 公園・スポーツ施設など */
const LEISURE: Record<string, { kind: PropertyKind; label: string }> = {
  park: { kind: 'land', label: '公園' },
  garden: { kind: 'land', label: '庭園' },
  playground: { kind: 'land', label: '遊び場' },
  pitch: { kind: 'land', label: 'グラウンド' },
  sports_centre: { kind: 'retail', label: 'スポーツ施設' },
  fitness_centre: { kind: 'retail', label: 'ジム' },
  stadium: { kind: 'retail', label: 'スタジアム' },
  golf_course: { kind: 'resort', label: 'ゴルフ場' },
  swimming_pool: { kind: 'retail', label: 'プール' },
  water_park: { kind: 'resort', label: 'レジャープール' },
  marina: { kind: 'resort', label: 'マリーナ' },
  track: { kind: 'land', label: '競技場' },
  nature_reserve: { kind: 'land', label: '保全地区' },
  dog_park: { kind: 'land', label: 'ドッグラン' },
  common: { kind: 'land', label: '共有地' },
};

/** 人工物（発電所・タンク・工作物など） */
const MAN_MADE: Record<string, { kind: PropertyKind; label: string }> = {
  works: { kind: 'factory', label: '工場' },
  wastewater_plant: { kind: 'factory', label: '下水処理場' },
  water_works: { kind: 'factory', label: '浄水場' },
  storage_tank: { kind: 'warehouse', label: 'タンク' },
  silo: { kind: 'warehouse', label: 'サイロ' },
  pier: { kind: 'land', label: '桟橋' },
  tower: { kind: 'land', label: '塔' },
  chimney: { kind: 'factory', label: '煙突' },
  water_tower: { kind: 'land', label: '給水塔' },
  bridge: { kind: 'land', label: '橋' },
};

/** 観光・宿泊 */
const TOURISM: Record<string, { kind: PropertyKind; label: string }> = {
  hotel: { kind: 'hotel', label: 'ホテル' },
  motel: { kind: 'hotel', label: 'モーテル' },
  guest_house: { kind: 'hotel', label: '民宿' },
  hostel: { kind: 'hotel', label: 'ホステル' },
  apartment: { kind: 'apartment', label: '民泊' },
  museum: { kind: 'retail', label: '博物館' },
  gallery: { kind: 'retail', label: '美術館' },
  attraction: { kind: 'retail', label: '観光施設' },
  theme_park: { kind: 'resort', label: '遊園地' },
  zoo: { kind: 'resort', label: '動物園' },
  aquarium: { kind: 'resort', label: '水族館' },
  camp_site: { kind: 'resort', label: 'キャンプ場' },
  caravan_site: { kind: 'resort', label: 'オートキャンプ場' },
  picnic_site: { kind: 'land', label: '休憩所' },
  viewpoint: { kind: 'land', label: '展望地' },
};

const BUILDING: Record<string, { kind: PropertyKind; label: string }> = {
  house: { kind: 'house', label: '住宅' },
  detached: { kind: 'house', label: '一戸建て' },
  semidetached_house: { kind: 'house', label: '住宅' },
  residential: { kind: 'house', label: '住宅' },
  bungalow: { kind: 'house', label: '住宅' },
  terrace: { kind: 'house', label: '長屋' },
  apartments: { kind: 'apartment', label: '集合住宅' },
  dormitory: { kind: 'apartment', label: '寮' },
  hotel: { kind: 'hotel', label: 'ホテル' },
  office: { kind: 'office', label: 'オフィス' },
  commercial: { kind: 'retail', label: '商業ビル' },
  retail: { kind: 'retail', label: '店舗' },
  supermarket: { kind: 'retail', label: 'スーパー' },
  kiosk: { kind: 'retail', label: '売店' },
  industrial: { kind: 'factory', label: '工場' },
  factory: { kind: 'factory', label: '工場' },
  manufacture: { kind: 'factory', label: '工場' },
  warehouse: { kind: 'warehouse', label: '倉庫' },
  hangar: { kind: 'warehouse', label: '格納庫' },
  storage_tank: { kind: 'warehouse', label: 'タンク' },
  farm: { kind: 'farm', label: '農家' },
  farm_auxiliary: { kind: 'farm', label: '農業用建物' },
  barn: { kind: 'farm', label: '納屋' },
  greenhouse: { kind: 'farm', label: '温室' },
  stable: { kind: 'farm', label: '厩舎' },
  school: { kind: 'office', label: '学校' },
  university: { kind: 'office', label: '大学' },
  hospital: { kind: 'office', label: '病院' },
  church: { kind: 'office', label: '教会' },
  temple: { kind: 'office', label: '寺院' },
  shrine: { kind: 'office', label: '神社' },
  train_station: { kind: 'retail', label: '駅' },
  civic: { kind: 'office', label: '公共施設' },
  public: { kind: 'office', label: '公共施設' },
  garage: { kind: 'land', label: '車庫' },
  garages: { kind: 'land', label: '車庫' },
  roof: { kind: 'land', label: '屋根だけの建物' },
  shed: { kind: 'land', label: '小屋' },
  hut: { kind: 'land', label: '小屋' },
  service: { kind: 'land', label: '設備' },
  construction: { kind: 'land', label: '建設中' },
  yes: { kind: 'house', label: '建物' },
};

const LANDUSE: Record<string, { kind: PropertyKind; label: string }> = {
  farmland: { kind: 'farm', label: '農地' },
  farmyard: { kind: 'farm', label: '農場' },
  orchard: { kind: 'farm', label: '果樹園' },
  meadow: { kind: 'farm', label: '牧草地' },
  vineyard: { kind: 'farm', label: 'ぶどう園' },
  forest: { kind: 'land', label: '森林' },
  industrial: { kind: 'factory', label: '工業用地' },
  commercial: { kind: 'retail', label: '商業用地' },
  retail: { kind: 'retail', label: '商業用地' },
  residential: { kind: 'land', label: '住宅用地' },
  construction: { kind: 'land', label: '造成地' },
  grass: { kind: 'land', label: '草地' },
  brownfield: { kind: 'land', label: '遊休地' },
  greenfield: { kind: 'land', label: '未利用地' },
  quarry: { kind: 'factory', label: '採石場' },
  allotments: { kind: 'farm', label: '市民農園' },
};

/** タグから種類とラベルを決める */
export function classifyOsm(tags: OsmTags): OsmKindInfo {
  if (tags.tourism && TOURISM[tags.tourism]) {
    const t = TOURISM[tags.tourism];
    return { kind: t.kind, label: t.label, fallbackName: t.label };
  }
  if (tags.tourism === 'resort' || tags.leisure === 'resort') return { kind: 'resort', label: 'リゾート', fallbackName: 'リゾート' };
  if (tags.shop) {
    const label = SHOP_LABEL[tags.shop] ?? '店舗';
    return { kind: 'retail', label, fallbackName: label };
  }
  if (tags.office) return { kind: 'office', label: 'オフィス', fallbackName: 'オフィス' };
  if (tags.amenity && AMENITY[tags.amenity]) {
    const a = AMENITY[tags.amenity];
    return { kind: a.kind, label: a.label, fallbackName: a.label };
  }
  if (tags.railway === 'station' || tags.public_transport === 'station') return { kind: 'retail', label: '駅', fallbackName: '駅' };
  if (tags.leisure && LEISURE[tags.leisure]) {
    const l = LEISURE[tags.leisure];
    return { kind: l.kind, label: l.label, fallbackName: l.label };
  }
  if (tags.man_made && MAN_MADE[tags.man_made]) {
    const m = MAN_MADE[tags.man_made];
    return { kind: m.kind, label: m.label, fallbackName: m.label };
  }
  if (tags.aeroway === 'terminal') return { kind: 'retail', label: '空港ターミナル', fallbackName: '空港ターミナル' };
  if (tags.aeroway === 'hangar') return { kind: 'warehouse', label: '格納庫', fallbackName: '格納庫' };
  if (tags.aeroway === 'apron') return { kind: 'land', label: 'エプロン', fallbackName: 'エプロン' };
  if (tags.building && BUILDING[tags.building]) {
    const b = BUILDING[tags.building];
    return { kind: b.kind, label: b.label, fallbackName: b.label };
  }
  if (tags.landuse && LANDUSE[tags.landuse]) {
    const l = LANDUSE[tags.landuse];
    return { kind: l.kind, label: l.label, fallbackName: l.label };
  }
  if (tags.building) return { kind: 'house', label: '建物', fallbackName: '建物' };
  return { kind: 'land', label: '土地', fallbackName: '土地' };
}

/** 種類ごとの既定の階数（OSM に building:levels がないとき） */
export const DEFAULT_LEVELS: Record<PropertyKind, number> = {
  land: 1,
  farm: 1,
  house: 2,
  apartment: 5,
  office: 5,
  retail: 2,
  hotel: 7,
  warehouse: 1,
  factory: 1,
  resort: 3,
};

/** 建物の価値の係数（土地の単価に対して、その用途ならどれくらいの値段になるか） */
export const KIND_VALUE_FACTOR: Record<PropertyKind, number> = {
  land: 1,
  farm: 0.25,
  house: 1.2,
  apartment: 1.5,
  office: 1.8,
  retail: 2,
  hotel: 1.8,
  warehouse: 0.9,
  factory: 1,
  resort: 1.6,
};

export function levelsFromTags(tags: OsmTags, kind: PropertyKind): number {
  const raw = tags['building:levels'];
  const n = raw ? Number.parseFloat(raw) : NaN;
  if (Number.isFinite(n) && n >= 1 && n <= 200) return Math.round(n);
  return DEFAULT_LEVELS[kind];
}
