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
  const tourism = tags.tourism;
  if (tourism === 'hotel' || tourism === 'motel' || tourism === 'guest_house' || tourism === 'hostel') {
    return { kind: 'hotel', label: '宿泊施設', fallbackName: '宿泊施設' };
  }
  if (tourism === 'resort' || tags.leisure === 'resort') return { kind: 'resort', label: 'リゾート', fallbackName: 'リゾート' };
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
  if (tags.man_made === 'works') return { kind: 'factory', label: '工場', fallbackName: '工場' };
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
