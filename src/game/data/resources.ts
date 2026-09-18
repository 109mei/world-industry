/** 資源・素材・製品の定義。ゲームロジックは必ずこのデータを参照する。 */
export type ResourceCategory = 'raw' | 'ore' | 'material' | 'part' | 'product';

export interface ResourceDef {
  id: string;
  name: string;
  nameEn: string;
  category: ResourceCategory;
  /** 市場の基準価格（円）。kg のものは 1kg あたり、g のものは 1g あたり、個のものは 1個あたり */
  basePrice: number;
  /**
   * 数える単位。ここが「1個ぶん」の実体を決める。
   * kg=1キログラム、g=1グラム、L=1リットル、個=1個。省略すると「個」。
   */
  unit?: 'kg' | 'g' | 'L' | '個';
  /** 1個あたりの重さ（t）。物流コストの計算用（将来） */
  weight: number;
  /** assets/icons 内のファイル名（拡張子なし） */
  icon: string;
  /** 市場で売れるか */
  sellable: boolean;
  /** この個数を一度に売ると価格が約5%下がる（流動性） */
  liquidity: number;
  /** 最初から資源一覧に表示するか */
  initialDiscovered?: boolean;
  /** 相場の荒さ（1 が普通。大きいほど上下に大きく動く） */
  volatility?: number;
  /** 市場から買えるか（転売できるもの） */
  buyable?: boolean;
  description: string;
}

export const RESOURCES = [
  { id: 'stone', name: '石', nameEn: 'Stone', category: 'raw', unit: 'kg', basePrice: 3, weight: 0.001, icon: 'icon_resource_stone', sellable: true, liquidity: 5_760_000, initialDiscovered: true, description: '最も基本的な資源。道具や建材の材料になる。' },
  { id: 'wood', name: '木', nameEn: 'Wood', category: 'raw', unit: 'kg', basePrice: 25, weight: 0.001, icon: 'icon_resource_wood', sellable: true, liquidity: 5_760_000, initialDiscovered: true, description: '道具の柄や燃料に使う。' },
  { id: 'water', name: '水', nameEn: 'Water', category: 'raw', unit: 'L', basePrice: 1, weight: 0.001, icon: 'icon_resource_water', sellable: true, liquidity: 11_520_000, initialDiscovered: true, description: '生活と工業の基本。将来は農業や工場で大量に使う。' },
  { id: 'sand', name: '砂', nameEn: 'Sand', category: 'raw', unit: 'kg', basePrice: 4, weight: 0.001, icon: 'icon_resource_sand', sellable: true, liquidity: 5_760_000, initialDiscovered: true, description: 'ガラスやコンクリートの材料。' },
  { id: 'plant_fiber', name: '植物繊維', nameEn: 'Plant Fiber', category: 'raw', unit: 'kg', basePrice: 60, weight: 0.001, icon: 'icon_resource_plant_fiber', sellable: true, liquidity: 4_320_000, initialDiscovered: true, description: 'ロープや布の材料。バケツづくりにも使う。' },
  { id: 'scrap_metal', name: '鉄くず', nameEn: 'Scrap Metal', category: 'raw', unit: 'kg', basePrice: 45, weight: 0.001, icon: 'icon_resource_scrap_metal', sellable: true, liquidity: 1_728_000, initialDiscovered: true, description: '拾い集めた金属くず。精錬すると鉄になる。' },
  { id: 'clay', name: '粘土', nameEn: 'Clay', category: 'raw', unit: 'kg', basePrice: 8, weight: 0.001, icon: 'icon_resource_clay', sellable: true, liquidity: 4_320_000, initialDiscovered: true, description: 'レンガや陶器の材料。' },
  { id: 'iron_ore', name: '鉄鉱石', nameEn: 'Iron Ore', category: 'ore', unit: 'kg', basePrice: 17, weight: 0.001, icon: 'icon_resource_iron_ore', sellable: true, liquidity: 2_160_000, description: 'つるはしで採掘できる鉱石。精錬して鉄にする。' },
  { id: 'coal', name: '石炭', nameEn: 'Coal', category: 'ore', unit: 'kg', basePrice: 20, weight: 0.001, icon: 'icon_resource_coal', sellable: true, liquidity: 2_160_000, description: '鋼鉄の生産や火力発電に使う。土地の鉱脈から採掘する。' },
  { id: 'iron', name: '鉄', nameEn: 'Iron', category: 'material', unit: 'kg', basePrice: 95, weight: 0.001, icon: 'icon_material_iron', sellable: true, liquidity: 576_000, description: '鉄鉱石や鉄くずを精錬した金属。工具や機械の材料。' },
  { id: 'steel', name: '鋼鉄', nameEn: 'Steel', category: 'material', unit: 'kg', basePrice: 130, weight: 0.001, icon: 'icon_material_steel', sellable: true, liquidity: 288_000, description: '鉄と石炭から作る高強度の金属。製鋼所で生産する。' },
  { id: 'rope', name: '縄', nameEn: 'Rope', category: 'material', unit: 'kg', basePrice: 300, weight: 0.001, icon: 'icon_part_cable_reel', sellable: true, liquidity: 2_880_000, description: '植物繊維をよった縄。建材や布の材料になる。' },
  { id: 'cloth', name: '布', nameEn: 'Cloth', category: 'material', unit: 'kg', basePrice: 900, weight: 0.001, icon: 'icon_material_textile', sellable: true, liquidity: 2_160_000, description: '縄と繊維を織った布。市場で安定して売れる。' },
  { id: 'concrete', name: 'コンクリート', nameEn: 'Concrete', category: 'material', unit: 'kg', basePrice: 7, weight: 0.001, icon: 'icon_material_concrete', sellable: true, liquidity: 3_600_000, description: '砂・石・水を練った建材。建材セットの材料。' },
  { id: 'cast_iron', name: '鋳鉄', nameEn: 'Cast Iron', category: 'material', unit: 'kg', basePrice: 85, weight: 0.001, icon: 'icon_material_steel_plate', sellable: true, liquidity: 2_160_000, description: '鉄くずを溶かして固めたもの。機械部品を安く作れる。' },
  { id: 'building_material', name: '建材セット', nameEn: 'Building Materials', category: 'product', basePrice: 15_000, weight: 0.2, icon: 'icon_marker_construction', sellable: true, liquidity: 1_008_000, description: 'レンガ・コンクリート・縄をまとめた建材。序盤の主力商品。' },
  { id: 'brick', name: 'レンガ', nameEn: 'Brick', category: 'material', unit: 'kg', basePrice: 25, weight: 0.001, icon: 'icon_facility_brick_factory', sellable: true, liquidity: 2_880_000, description: '粘土を焼いた建材。' },
  { id: 'machine_parts', name: '機械部品', nameEn: 'Machine Parts', category: 'part', basePrice: 3000, weight: 0.005, icon: 'icon_part_gear_set', sellable: true, liquidity: 86_400, description: '鉄から作る部品。高価な製品の材料。' },
  { id: 'tool', name: '工具', nameEn: 'Tools', category: 'product', basePrice: 2500, weight: 0.001, icon: 'icon_tool_wrench', sellable: true, liquidity: 115_200, description: '鉄と木から作る製品。序盤の主力商品。' },
  // ---- 土地・電力・物流以降で使う資源 ----
  { id: 'copper_ore', name: '銅精鉱', nameEn: 'Copper Concentrate', category: 'ore', unit: 'kg', basePrice: 150, weight: 0.001, icon: 'icon_resource_copper_ore', sellable: true, liquidity: 1_728_000, description: '銅の原料。土地の鉱脈から採掘する。' },
  { id: 'crude_oil', name: '原油', nameEn: 'Crude Oil', category: 'ore', unit: 'L', basePrice: 75, weight: 0.001, icon: 'icon_resource_crude_oil', sellable: true, liquidity: 1_296_000, description: '油田から汲み上げる。出る土地はごく限られていて、当たれば大きい。精製して燃料にする。' },
  { id: 'uranium_ore', name: 'ウラン鉱石', nameEn: 'Uranium Ore', category: 'ore', unit: 'kg', basePrice: 1500, weight: 0.001, icon: 'icon_resource_uranium', sellable: true, liquidity: 72_000, description: '原子力燃料の原料。ごく限られた土地にしかない。' },
  { id: 'wheat', name: '小麦', nameEn: 'Wheat', category: 'raw', unit: 'kg', basePrice: 45, weight: 0.001, icon: 'icon_resource_wheat', sellable: true, liquidity: 7_200_000, description: '農園で育てる。平原で効率が高い。' },
  { id: 'copper', name: '銅', nameEn: 'Copper', category: 'material', unit: 'kg', basePrice: 1500, weight: 0.001, icon: 'icon_material_copper', sellable: true, liquidity: 432_000, description: '銅鉱石を精錬した金属。電線や電子部品の材料。' },
  { id: 'fuel', name: '燃料', nameEn: 'Fuel', category: 'material', unit: 'L', basePrice: 130, weight: 0.001, icon: 'icon_material_fuel', sellable: true, liquidity: 1_152_000, description: '原油を精製した燃料。火力発電やトラックの燃料になる。' },
  { id: 'nuclear_fuel', name: '核燃料', nameEn: 'Nuclear Fuel', category: 'material', unit: 'kg', basePrice: 400_000, weight: 0.001, icon: 'icon_grid_fuel_cell', sellable: false, liquidity: 7_200, description: 'ウラン鉱石を濃縮した燃料。原子力発電所で使う。' },
  { id: 'electronics', name: '電子部品', nameEn: 'Electronics', category: 'part', basePrice: 2000, weight: 0.0005, icon: 'icon_material_electronics', sellable: true, liquidity: 57_600, description: '銅と鋼鉄から作る高付加価値の部品。' },
  { id: 'flour', name: '小麦粉', nameEn: 'Flour', category: 'product', basePrice: 120, weight: 0.001, icon: 'icon_food_flour', sellable: true, liquidity: 4_320_000, description: '小麦を製粉した食品。安定して売れる。' },
  // ---- 巨大産業（自動車・半導体・ロボット） ----
  { id: 'rubber', name: 'ゴム', nameEn: 'Rubber', category: 'raw', unit: 'kg', basePrice: 250, weight: 0.001, icon: 'icon_resource_rubber', sellable: true, liquidity: 1_152_000, description: 'ゴム農園で採れる。タイヤなど自動車の材料。森林の土地で効率が高い。' },
  { id: 'glass', name: 'ガラス', nameEn: 'Glass', category: 'material', unit: 'kg', basePrice: 120, weight: 0.001, icon: 'icon_material_glass', sellable: true, liquidity: 576_000, description: '砂と石炭から作る。窓や自動車の材料。' },
  { id: 'plastic', name: 'プラスチック', nameEn: 'Plastic', category: 'material', unit: 'kg', basePrice: 220, weight: 0.001, icon: 'icon_material_plastic', sellable: true, liquidity: 576_000, description: '原油から作る素材。自動車や家電の材料。' },
  { id: 'silicon', name: 'シリコンウエハー', nameEn: 'Silicon Wafer', category: 'material', unit: 'kg', basePrice: 3000, weight: 0.001, icon: 'icon_material_silicon_wafer', sellable: true, liquidity: 86_400, description: '砂から精製した高純度シリコンの円板。半導体の材料。' },
  { id: 'semiconductor', name: '半導体', nameEn: 'Semiconductor', category: 'part', basePrice: 50_000, weight: 0.00001, icon: 'icon_material_semiconductor', sellable: true, liquidity: 28_800, description: 'シリコンウエハーと銅から作る最先端の部品。非常に高価。' },
  { id: 'car', name: '自動車', nameEn: 'Car', category: 'product', basePrice: 3_000_000, weight: 1.5, icon: 'icon_logistics_van', sellable: true, liquidity: 7_200, description: '鋼鉄・プラスチック・ゴム・ガラス・電子部品を組み立てた製品。重いので輸送費がかかる。' },
  { id: 'robot', name: '産業ロボット', nameEn: 'Industrial Robot', category: 'product', basePrice: 8_000_000, weight: 0.5, icon: 'icon_part_robot_arm', sellable: true, liquidity: 4_320, description: '半導体と機械部品から作る最高級の製品。' },
  // ---- v1.0 追加の素材・製品 ----
  { id: 'sap', name: '樹液', nameEn: 'Sap', category: 'raw', unit: 'kg', basePrice: 40, weight: 0.001, icon: 'icon_chemical_resin', sellable: true, liquidity: 2_160_000, description: '森でとれる樹液。煮詰めるとゴムになる。ゴム農園がなくても集められる。' },
  { id: 'charcoal', name: '木炭', nameEn: 'Charcoal', category: 'material', unit: 'kg', basePrice: 130, weight: 0.001, icon: 'icon_resource_coal', sellable: true, liquidity: 2_880_000, description: '木を蒸し焼きにしたもの。石炭の代わりに燃料として使える。' },
  { id: 'lumber', name: '板材', nameEn: 'Lumber', category: 'material', unit: 'kg', basePrice: 60, weight: 0.001, icon: 'icon_material_plywood', sellable: true, liquidity: 3_600_000, description: '製材した板。家具や建材になる。' },
  { id: 'paper', name: '紙', nameEn: 'Paper', category: 'material', unit: 'kg', basePrice: 120, weight: 0.001, icon: 'icon_material_paper', sellable: true, liquidity: 2_880_000, description: '繊維と水から作る紙。梱包や事務に使う。' },
  { id: 'wire', name: '電線', nameEn: 'Wire', category: 'part', basePrice: 2000, weight: 0.001, icon: 'icon_material_wire', sellable: true, liquidity: 1_152_000, description: '銅を引き伸ばした線。電池や電子部品に使う。' },
  { id: 'chemical', name: '化学薬品', nameEn: 'Chemicals', category: 'material', unit: 'L', basePrice: 200, weight: 0.001, icon: 'icon_material_chemical', sellable: true, liquidity: 864_000, description: '原油と水から作る。塗料・肥料・電池のもと。' },
  { id: 'paint', name: '塗料', nameEn: 'Paint', category: 'material', unit: 'L', basePrice: 500, weight: 0.001, icon: 'icon_chemical_paint', sellable: true, liquidity: 720_000, description: '化学薬品と砂から作る。自動車や建物に使う。' },
  { id: 'fertilizer', name: '肥料', nameEn: 'Fertilizer', category: 'product', basePrice: 80, weight: 0.001, icon: 'icon_material_fertilizer', sellable: true, liquidity: 1_008_000, description: '農園の収穫を助ける。売っても高い。' },
  { id: 'food', name: '加工食品', nameEn: 'Processed Food', category: 'product', basePrice: 600, weight: 0.001, icon: 'icon_food_bread', sellable: true, liquidity: 1_728_000, description: '小麦粉と水から作る食品。街で安定して売れる。' },
  { id: 'clothing', name: '衣類', nameEn: 'Clothing', category: 'product', basePrice: 4000, weight: 0.0005, icon: 'icon_material_leather', sellable: true, liquidity: 720_000, description: '布と縄から仕立てた衣類。' },
  { id: 'furniture', name: '家具', nameEn: 'Furniture', category: 'product', basePrice: 40_000, weight: 0.05, icon: 'icon_office_chair', sellable: true, liquidity: 216_000, description: '板材と布から作る家具。住宅やオフィスに売れる。' },
  { id: 'tire', name: 'タイヤ', nameEn: 'Tire', category: 'part', basePrice: 12_000, weight: 0.01, icon: 'icon_machine_wheel_loader', sellable: true, liquidity: 432_000, description: 'ゴムと布から作る。自動車に必要。' },
  { id: 'battery', name: 'バッテリー', nameEn: 'Battery', category: 'part', basePrice: 30_000, weight: 0.02, icon: 'icon_material_battery', sellable: true, liquidity: 172_800, description: '電線・プラスチック・化学薬品から作る。電気自動車やロボットに使う。' },
  // ---- 貴金属・宝石（激レア） ----
  { id: 'gold_ore', name: '金鉱石', nameEn: 'Gold Ore', category: 'ore', unit: 'kg', basePrice: 25_000, weight: 0.001, icon: 'icon_resource_rare_earth', sellable: true, liquidity: 86_400, description: 'ごくまれにしか出ない鉱石。精錬すると金になる。当たった土地は宝の山。' },
  { id: 'silver_ore', name: '銀鉱石', nameEn: 'Silver Ore', category: 'ore', unit: 'kg', basePrice: 90, weight: 0.001, icon: 'icon_resource_nickel', sellable: true, liquidity: 201_600, description: '金ほどではないが珍しい鉱石。精錬すると銀になる。' },
  { id: 'rough_gem', name: '宝石の原石', nameEn: 'Rough Gem', category: 'ore', unit: 'kg', basePrice: 20_000, weight: 0.001, icon: 'icon_resource_gravel', sellable: true, liquidity: 43_200, description: '磨く前の石。当たり外れが大きく、めったに出ない。' },
  { id: 'gold', name: '金', nameEn: 'Gold', category: 'material', unit: 'g', basePrice: 18_000, weight: 0.000001, icon: 'icon_office_coins', sellable: true, liquidity: 57_600, description: '金鉱石を精錬した貴金属。値崩れしにくく、持っているだけで資産になる。' },
  { id: 'silver', name: '銀', nameEn: 'Silver', category: 'material', unit: 'g', basePrice: 130, weight: 0.000001, icon: 'icon_material_aluminum', sellable: true, liquidity: 129_600, description: '銀鉱石を精錬した貴金属。装飾にも電子部品にも使う。' },
  { id: 'gem', name: '宝石', nameEn: 'Gem', category: 'product', basePrice: 120_000, weight: 0.00001, icon: 'icon_resource_gem', sellable: true, liquidity: 28_800, description: '原石を磨いたもの。宝石店に並べるとブランド価値がそのまま値段になる。' },
  { id: 'leather', name: '革', nameEn: 'Leather', category: 'material', unit: 'kg', basePrice: 2500, weight: 0.001, icon: 'icon_material_leather', sellable: true, liquidity: 432_000, description: '布と化学薬品からなめして作る。鞄や靴、家具に使う。' },
  // ---- 転売できるもの（相場が荒く、市場から買える） ----
  { id: 'gpu', name: 'GPU', nameEn: 'GPU', category: 'part', basePrice: 120_000, weight: 0.0015, icon: 'icon_part_gpu', sellable: true, buyable: true, volatility: 2.2, liquidity: 43_200, description: '画像も計算もこなす高性能な部品。マイニングの流行り廃りで値段が跳ね、品薄になると転売で儲かる。' },
  { id: 'crypto', name: '暗号資産', nameEn: 'Crypto', category: 'product', basePrice: 9_000_000, weight: 0, icon: 'icon_product_crypto', sellable: true, buyable: true, volatility: 3.4, liquidity: 86_400, description: 'マイニング装置が掘り出す通貨。値動きがとても荒く、上がったところで売れれば大きい。' },
  // ---- v1.6 追加: 建材・軽金属・化学・生活の筋 ----
  { id: 'limestone', name: '石灰石', nameEn: 'Limestone', category: 'ore', unit: 'kg', basePrice: 3, weight: 0.001, icon: 'icon_resource_limestone', sellable: true, liquidity: 3_600_000, description: 'セメントの原料。山の採石場で採れ、手でも拾える。' },
  { id: 'cement', name: 'セメント', nameEn: 'Cement', category: 'material', unit: 'kg', basePrice: 15, weight: 0.001, icon: 'icon_material_cement', sellable: true, liquidity: 2_304_000, description: '石灰石を焼いたもの。生コンにすると少ない砂でコンクリートが作れる。' },
  { id: 'bauxite', name: 'ボーキサイト', nameEn: 'Bauxite', category: 'ore', unit: 'kg', basePrice: 8, weight: 0.001, icon: 'icon_resource_bauxite', sellable: true, liquidity: 1_728_000, description: 'アルミの原料。精錬にはたくさんの電気が要る。' },
  { id: 'aluminum', name: 'アルミ', nameEn: 'Aluminum', category: 'material', unit: 'kg', basePrice: 400, weight: 0.001, icon: 'icon_material_aluminum_ingot', sellable: true, liquidity: 1_008_000, description: '軽くて錆びない金属。電気を大量に使って作る。' },
  { id: 'sulfur', name: '硫黄', nameEn: 'Sulfur', category: 'ore', unit: 'kg', basePrice: 20, weight: 0.001, icon: 'icon_resource_sulfur', sellable: true, liquidity: 1_728_000, description: '火山のふもとで採れる。薬品や肥料のもと。' },
  { id: 'ammonia', name: 'アンモニア', nameEn: 'Ammonia', category: 'material', unit: 'kg', basePrice: 60, weight: 0.001, icon: 'icon_chemical_ammonia', sellable: true, liquidity: 1_296_000, description: '窒素肥料のもと。作るのに熱と電気が要る。' },
  { id: 'ceramic', name: '陶磁器', nameEn: 'Ceramic', category: 'material', unit: 'kg', basePrice: 400, weight: 0.001, icon: 'icon_material_ceramic', sellable: true, liquidity: 1_152_000, description: '粘土を高い温度で焼いたもの。食器にも部品にもなる。' },
  { id: 'book', name: '書籍', nameEn: 'Book', category: 'product', basePrice: 1500, weight: 0.0005, icon: 'icon_office_training_book', sellable: true, liquidity: 864_000, description: '紙と塗料から刷る。紙の使い道。' },
  { id: 'leather_goods', name: '革製品', nameEn: 'Leather Goods', category: 'product', basePrice: 15_000, weight: 0.001, icon: 'icon_product_leather_goods', sellable: true, liquidity: 504_000, description: '鞄や靴。革と布から仕立てる。' },
  { id: 'jewelry', name: '宝飾品', nameEn: 'Jewelry', category: 'product', basePrice: 400_000, weight: 0.00005, icon: 'icon_product_jewelry', sellable: true, liquidity: 129_600, description: '金・銀・宝石を仕立てたもの。重さがないわりに、とても高く売れる。' },
  { id: 'bearing', name: 'ベアリング', nameEn: 'Bearing', category: 'part', basePrice: 2000, weight: 0.002, icon: 'icon_part_bearing', sellable: true, liquidity: 1_008_000, description: '回るところには必ず要る部品。' },
  { id: 'motor', name: '電動機', nameEn: 'Electric Motor', category: 'part', basePrice: 25_000, weight: 0.02, icon: 'icon_part_electric_motor', sellable: true, liquidity: 576_000, description: '銅線とベアリングで作る。機械を動かす心臓。' },
] as const satisfies readonly ResourceDef[];

export type ResourceId = (typeof RESOURCES)[number]['id'];

export const RESOURCE_MAP: Record<ResourceId, ResourceDef> = Object.fromEntries(
  RESOURCES.map((r) => [r.id, r]),
) as Record<ResourceId, ResourceDef>;

export const RESOURCE_IDS = RESOURCES.map((r) => r.id) as ResourceId[];

/** 市場から買えるもの（転売できるもの） */
export const BUYABLE_RESOURCES: ResourceId[] = RESOURCES.filter((r) => (r as ResourceDef).buyable).map((r) => r.id as ResourceId);

export function getResource(id: ResourceId): ResourceDef {
  return RESOURCE_MAP[id];
}

export function isResourceId(id: string): id is ResourceId {
  return id in RESOURCE_MAP;
}

export const RESOURCE_CATEGORY_LABEL: Record<ResourceCategory, string> = {
  raw: '天然資源',
  ore: '鉱石',
  material: '加工素材',
  part: '部品',
  product: '製品',
};
