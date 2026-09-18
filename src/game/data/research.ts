import type { FacilityCategory } from './facilities';

export type ResearchEffect =
  | { type: 'production'; category: FacilityCategory | 'all'; mult: number }
  | { type: 'powerGeneration'; mult: number }
  | { type: 'renewableGeneration'; mult: number }
  | { type: 'transportCapacity'; mult: number }
  | { type: 'transportCost'; mult: number }
  | { type: 'survey'; costMult: number; timeMult: number }
  | { type: 'storage'; mult: number }
  | { type: 'commercialIncome'; mult: number }
  /** 市場の需要の回復速度 */
  | { type: 'demandRecovery'; mult: number }
  /** 人件費 */
  | { type: 'wage'; mult: number }
  /** 事業の仕事量（開発力・接客力） */
  | { type: 'devSpeed'; mult: number }
  /** 発売した製品の収入 */
  | { type: 'productRevenue'; mult: number }
  /** お店の売値 */
  | { type: 'shopSales'; mult: number }
  /** 広告の費用 */
  | { type: 'adCost'; mult: number }
  /** 知名度の上がりやすさ */
  | { type: 'awarenessGain'; mult: number }
  /** ブランド価値の上がりやすさ */
  | { type: 'brandGain'; mult: number }
  /** 研究ポイントそのもの */
  | { type: 'researchRate'; mult: number }
  /** 説明だけの効果（解放は各定義の unlock 条件で参照する） */
  | { type: 'unlock'; text: string };

/** 研究の系統（ツリーの列） */
export type ResearchBranch = 'industry' | 'logistics' | 'energy' | 'management' | 'tech' | 'service';

export const BRANCH_LABEL: Record<ResearchBranch, string> = {
  industry: '生産・素材',
  logistics: '物流',
  energy: 'エネルギー',
  management: '経営・商業',
  tech: '情報技術',
  service: 'サービス・金融',
};

export interface ResearchDef {
  id: string;
  name: string;
  icon: string;
  /** どの系統か（ツリーの並べ方に使う） */
  branch?: ResearchBranch;
  /** 必要な研究ポイント */
  cost: number;
  /** 前提となる研究 */
  requires: string[];
  effects: ResearchEffect[];
  description: string;
}

export const RESEARCH = [
  { id: 'geology', name: '地質学', icon: 'icon_marker_survey', branch: 'industry', cost: 40, requires: [], effects: [{ type: 'survey', costMult: 0.7, timeMult: 0.6 }], description: '地下資源調査の費用 -30%、時間 -40%。' },
  { id: 'metallurgy', name: '冶金学', icon: 'icon_material_steel', branch: 'industry', cost: 200, requires: ['geology'], effects: [{ type: 'production', category: 'PROCESSING', mult: 1.2 }], description: '精錬・加工の施設の生産 +20%。' },
  { id: 'chemistry', name: '化学工学', icon: 'icon_material_chemical', branch: 'industry', cost: 250, requires: [], effects: [{ type: 'production', category: 'PROCESSING', mult: 1.15 }], description: '化学の基礎。薬品・塗料・肥料の道が開ける。加工施設の生産 +15%。' },
  { id: 'automation', name: '自動化', icon: 'icon_part_robot_arm', branch: 'industry', cost: 120, requires: [], effects: [{ type: 'production', category: 'RESOURCE', mult: 1.25 }], description: '採集・採掘施設の生産 +25%。' },
  { id: 'tanning', name: 'なめし', icon: 'icon_material_leather', branch: 'industry', cost: 1500, requires: ['chemistry'], effects: [{ type: 'unlock', text: '革' }], description: '布と化学薬品から革を作れるようになる。' },
  { id: 'gold_rush', name: '砂金採り', icon: 'icon_office_coins', branch: 'industry', cost: 2000, requires: ['geology'], effects: [{ type: 'unlock', text: '「砂金を探す」' }], description: '川原で砂金を探せるようになる。めったに見つからないが、見つかれば大きい。' },
  { id: 'deep_mining', name: '深部採掘', icon: 'icon_machine_drilling_rig', branch: 'industry', cost: 25000, requires: ['geology', 'metallurgy'], effects: [{ type: 'survey', costMult: 0.8, timeMult: 0.8 }, { type: 'production', category: 'RESOURCE', mult: 1.3 }], description: '深いところまで掘れるようになる。採掘施設の生産 +30%、調査もさらに安く。' },
  { id: 'gem_cutting', name: '宝石研磨', icon: 'icon_resource_gem', branch: 'industry', cost: 8000, requires: ['gold_rush', 'precision'], effects: [{ type: 'unlock', text: '原石を磨く' }], description: '原石を磨いて宝石にできる。値段が桁違いになる。' },
  { id: 'precision', name: '精密加工', icon: 'icon_facility_machine_factory', branch: 'industry', cost: 1200, requires: ['metallurgy'], effects: [{ type: 'production', category: 'MANUFACTURING', mult: 1.2 }], description: '製造施設の生産 +20%。' },
  { id: 'quality', name: '品質管理', icon: 'icon_office_documents', branch: 'industry', cost: 3000, requires: ['precision'], effects: [{ type: 'brandGain', mult: 1.2 }, { type: 'production', category: 'MANUFACTURING', mult: 1.1 }], description: '不良が減り、ブランドが上がりやすくなる。製造施設の生産 +10%。' },
  { id: 'mass_production', name: '大量生産', icon: 'icon_ui_factory', branch: 'industry', cost: 12000, requires: ['quality'], effects: [{ type: 'production', category: 'all', mult: 1.15 }], description: 'すべての施設の生産 +15%。' },
  { id: 'mass_storage', name: '大規模保管', icon: 'icon_logistics_storage_rack', branch: 'industry', cost: 200, requires: [], effects: [{ type: 'storage', mult: 1.5 }], description: 'すべての倉庫容量 +50%。' },
  { id: 'advanced_materials', name: '先端素材', icon: 'icon_material_semiconductor', branch: 'industry', cost: 500, requires: ['automation'], effects: [{ type: 'unlock', text: '電子部品工場' }, { type: 'production', category: 'MANUFACTURING', mult: 1.2 }], description: '電子部品工場を建てられる。製造施設の生産 +20%。' },
  { id: 'new_materials', name: '新素材', icon: 'icon_material_carbon_fiber', branch: 'industry', cost: 40000, requires: ['advanced_materials', 'chemistry'], effects: [{ type: 'production', category: 'MANUFACTURING', mult: 1.25 }], description: '軽くて強い素材を扱える。製造施設の生産 +25%。パソコン製造の試作にも使う。' },
  { id: 'electronics_eng', name: '電子工学', icon: 'icon_material_electronics', branch: 'industry', cost: 8000, requires: ['advanced_materials'], effects: [{ type: 'unlock', text: '家電メーカー' }], description: '家電メーカーを始められる。' },
  { id: 'appliances', name: '家電製造', icon: 'icon_material_electronics', branch: 'industry', cost: 15000, requires: ['electronics_eng', 'quality'], effects: [{ type: 'production', category: 'MANUFACTURING', mult: 1.1 }], description: '家電の量産ができるようになる。' },
  { id: 'pc_maker', name: 'パソコン製造', icon: 'icon_material_semiconductor', branch: 'industry', cost: 20000, requires: ['electronics_eng'], effects: [{ type: 'unlock', text: 'パソコン製造' }], description: 'パソコンを開発して売る会社を始められる。' },
  { id: 'semiconductor', name: '半導体産業', icon: 'icon_material_semiconductor', branch: 'industry', cost: 2500, requires: ['advanced_materials', 'commerce'], effects: [{ type: 'unlock', text: 'シリコン精製所・半導体工場' }], description: 'シリコン精製所と半導体工場を建てられる。半導体は1個8,000円。' },
  { id: 'gpu_design', name: 'GPU設計', icon: 'icon_part_robot_arm', branch: 'industry', cost: 120000, requires: ['semiconductor', 'pc_maker'], effects: [{ type: 'productRevenue', mult: 1.2 }], description: '処理装置を自分で設計できる。高性能機の開発が解放され、製品の収入 +20%。' },
  { id: 'automotive', name: '自動車産業', icon: 'icon_facility_vehicle_factory', branch: 'industry', cost: 1200, requires: ['advanced_materials'], effects: [{ type: 'unlock', text: 'ゴム農園・自動車工場' }], description: 'ゴム農園と自動車工場を建てられる。自動車は1台3万円で売れる。' },
  { id: 'car_maker', name: '自動車メーカー', icon: 'icon_facility_vehicle_factory', branch: 'industry', cost: 60000, requires: ['automotive', 'mass_production'], effects: [{ type: 'unlock', text: '自動車メーカー' }], description: '自社ブランドの車を開発して売る会社を始められる。' },
  { id: 'food_industry', name: '食品工業', icon: 'icon_facility_food_factory', branch: 'industry', cost: 6000, requires: ['chemistry'], effects: [{ type: 'unlock', text: '食品メーカー' }], description: '加工食品を開発して売る会社を始められる。' },
  { id: 'pharmaceutics', name: '製薬', icon: 'icon_facility_chemical_plant', branch: 'industry', cost: 50000, requires: ['chemistry', 'quality'], effects: [{ type: 'unlock', text: '製薬会社' }], description: '薬を開発する会社を始められる。時間はかかるが長く売れる。' },
  { id: 'shipbuilding', name: '造船', icon: 'icon_logistics_ship', branch: 'industry', cost: 90000, requires: ['mass_production', 'metallurgy'], effects: [{ type: 'unlock', text: '造船所' }], description: '船を建造する会社を始められる。' },
  { id: 'aerospace', name: '航空宇宙', icon: 'icon_logistics_airplane', branch: 'industry', cost: 250000, requires: ['aviation', 'mass_production'], effects: [{ type: 'unlock', text: '航空機メーカー' }], description: '旅客機や部品を作る会社を始められる。最も難しく、最も単価が高い。' },
  { id: 'robotics', name: 'ロボット工学', icon: 'icon_part_robot_arm', branch: 'industry', cost: 5000, requires: ['semiconductor', 'automotive'], effects: [{ type: 'unlock', text: 'ロボット工場' }, { type: 'production', category: 'all', mult: 1.1 }], description: 'ロボット工場を建てられる。すべての施設の生産 +10%。' },
  { id: 'railway', name: '鉄道輸送', icon: 'icon_logistics_train', branch: 'logistics', cost: 120, requires: [], effects: [{ type: 'unlock', text: '貨物列車' }], description: '土地に貨物列車を配備できる。トラックの10倍の輸送力。' },
  { id: 'overseas', name: '海外進出', icon: 'icon_logistics_ship', branch: 'logistics', cost: 150, requires: ['geology'], effects: [{ type: 'unlock', text: '海外の土地' }], description: '海外の土地を購入できるようになる。' },
  { id: 'pipeline', name: 'パイプライン', icon: 'icon_logistics_pipeline', branch: 'logistics', cost: 250, requires: ['railway'], effects: [{ type: 'unlock', text: 'パイプライン' }], description: '原油・燃料・水を安く大量に運ぶパイプラインを敷ける。' },
  { id: 'logistics_ai', name: '物流最適化', icon: 'icon_office_dashboard', branch: 'logistics', cost: 400, requires: ['railway'], effects: [{ type: 'transportCapacity', mult: 1.3 }, { type: 'transportCost', mult: 0.75 }], description: '輸送能力 +30%、輸送費 -25%。' },
  { id: 'aviation', name: '航空輸送', icon: 'icon_logistics_airplane', branch: 'logistics', cost: 800, requires: ['logistics_ai'], effects: [{ type: 'unlock', text: '貨物機' }], description: 'どの土地にも配備できる貨物機を使える。地震の影響を受けない。' },
  { id: 'warehouse_auto', name: '倉庫自動化', icon: 'icon_logistics_storage_rack', branch: 'logistics', cost: 15000, requires: ['mass_storage', 'automation'], effects: [{ type: 'storage', mult: 1.6 }], description: '倉庫容量 +60%。積み下ろしも速くなる。' },
  { id: 'freight_business', name: '運送業', icon: 'icon_logistics_truck', branch: 'logistics', cost: 5000, requires: ['railway'], effects: [{ type: 'unlock', text: '運送会社' }], description: 'よその会社の荷物を運ぶ会社を始められる。' },
  { id: 'cold_chain', name: '冷蔵輸送', icon: 'icon_logistics_truck', branch: 'logistics', cost: 20000, requires: ['freight_business', 'chemistry'], effects: [{ type: 'transportCost', mult: 0.9 }], description: '冷やしたまま運べる。食品と薬の単価が高い仕事を受けられる。' },
  { id: 'port_ops', name: '港湾運営', icon: 'icon_logistics_container_crane', branch: 'logistics', cost: 60000, requires: ['freight_business', 'overseas'], effects: [{ type: 'transportCapacity', mult: 1.2 }], description: '港のコンテナ基地を運営できる。輸送能力 +20%。' },
  { id: 'rail_business', name: '鉄道事業', icon: 'icon_logistics_train', branch: 'logistics', cost: 150000, requires: ['freight_business', 'logistics_ai'], effects: [{ type: 'unlock', text: '鉄道会社' }], description: '自分の路線を持って人と荷物を運べる。' },
  { id: 'airline_business', name: '航空事業', icon: 'icon_logistics_airplane', branch: 'logistics', cost: 250000, requires: ['aviation', 'port_ops'], effects: [{ type: 'unlock', text: '航空会社' }], description: '路線を開いて飛ばす会社を始められる。' },
  { id: 'construction_business', name: '建設業', icon: 'icon_machine_tower_crane', branch: 'logistics', cost: 8000, requires: ['mass_storage', 'metallurgy'], effects: [{ type: 'unlock', text: '建設会社' }], description: '家やビルを建てる会社を始められる。' },
  { id: 'structural', name: '構造設計', icon: 'icon_machine_tower_crane', branch: 'logistics', cost: 25000, requires: ['construction_business', 'precision'], effects: [], description: '中層ビルを建てられるようになる。' },
  { id: 'civil_works', name: '土木', icon: 'icon_machine_excavator', branch: 'logistics', cost: 70000, requires: ['structural'], effects: [], description: '道路や橋など、公共の大きな仕事を受けられる。' },
  { id: 'skyscraper', name: '超高層建築', icon: 'icon_machine_tower_crane', branch: 'logistics', cost: 300000, requires: ['civil_works', 'mass_production'], effects: [{ type: 'brandGain', mult: 1.3 }], description: '超高層ビルを建てられる。完成すると会社の名前が街に残る。' },
  { id: 'realestate_business', name: '不動産業', icon: 'icon_commercial_office', branch: 'logistics', cost: 15000, requires: ['commerce'], effects: [{ type: 'unlock', text: '不動産会社' }], description: '土地と建物を扱う会社を始められる。自社の物件の賃料も上がる。' },
  { id: 'grid', name: '送電網', icon: 'icon_power_transmission_tower', branch: 'energy', cost: 100, requires: [], effects: [{ type: 'powerGeneration', mult: 1.15 }], description: 'すべての発電所の出力 +15%。' },
  { id: 'renewables', name: '再生可能エネルギー', icon: 'icon_power_wind', branch: 'energy', cost: 250, requires: ['grid'], effects: [{ type: 'unlock', text: '太陽光・風力・水力発電' }, { type: 'renewableGeneration', mult: 1.3 }], description: '太陽光・風力・水力発電所を建てられる。再生可能エネルギーの出力 +30%。' },
  { id: 'efficiency', name: '省エネ設計', icon: 'icon_power_transmission_tower', branch: 'energy', cost: 5000, requires: ['grid'], effects: [{ type: 'powerGeneration', mult: 1.2 }], description: '設備の電気の使い方を見直す。発電の出力 +20%。' },
  { id: 'nuclear', name: '原子力工学', icon: 'icon_power_nuclear', branch: 'energy', cost: 3000, requires: ['advanced_materials', 'renewables'], effects: [{ type: 'unlock', text: 'ウラン鉱山・濃縮工場・原子力発電所' }], description: 'ウラン鉱山・核燃料濃縮工場・原子力発電所を建てられる。' },
  { id: 'storage_battery', name: '大規模蓄電', icon: 'icon_material_battery', branch: 'energy', cost: 30000, requires: ['renewables', 'chemistry'], effects: [{ type: 'renewableGeneration', mult: 1.4 }], description: '発電した電気をためておける。再生可能エネルギーの出力 +40%。' },
  { id: 'fusion', name: '核融合', icon: 'icon_power_nuclear', branch: 'energy', cost: 1000000, requires: ['nuclear', 'ai'], effects: [{ type: 'powerGeneration', mult: 3 }], description: '夢の発電。すべての発電所の出力が3倍になる。' },
  { id: 'accounting', name: '会計', icon: 'icon_office_documents', branch: 'management', cost: 60, requires: [], effects: [{ type: 'researchRate', mult: 1.1 }], description: '帳簿を整える。研究ポイント +10%。ここから経営の枝が伸びる。' },
  { id: 'commerce', name: '商業開発', icon: 'icon_commercial_office', branch: 'management', cost: 300, requires: ['overseas'], effects: [{ type: 'unlock', text: 'オフィス・データセンター' }, { type: 'commercialIncome', mult: 1.5 }], description: 'オフィスとデータセンターを建てられる。商業施設の収益 +50%。' },
  { id: 'marketing', name: 'マーケティング', icon: 'icon_ui_chart_trend', branch: 'management', cost: 600, requires: ['commerce'], effects: [{ type: 'demandRecovery', mult: 1.6 }], description: '市場の需要の回復速度 +60%。大量に売っても値崩れから早く戻る。' },
  { id: 'hr', name: '人事制度', icon: 'icon_facility_worker', branch: 'management', cost: 200, requires: ['accounting'], effects: [{ type: 'wage', mult: 0.92 }], description: '働きやすさを整える。人件費 -8%。' },
  { id: 'labor', name: '労務改善', icon: 'icon_facility_worker', branch: 'management', cost: 900, requires: ['hr'], effects: [{ type: 'wage', mult: 0.9 }, { type: 'devSpeed', mult: 1.1 }], description: '人件費 -10%、事業の仕事量 +10%。' },
  { id: 'retail', name: '小売経営', icon: 'icon_commercial_shop', branch: 'management', cost: 150, requires: ['accounting'], effects: [{ type: 'unlock', text: '個人商店' }], description: '自分のお店を開けるようになる。仕入れて並べて売る商売の入口。' },
  { id: 'parking', name: '駐車場経営', icon: 'icon_commercial_parking', branch: 'management', cost: 600, requires: ['retail'], effects: [{ type: 'unlock', text: '駐車場の割り当て' }], description: '持っている土地を駐車場として店に割り当てられる。車で来る客が入れるようになる。' },
  { id: 'food_service', name: '飲食業', icon: 'icon_commercial_restaurant', branch: 'management', cost: 400, requires: ['retail'], effects: [{ type: 'unlock', text: '飲食店' }], description: '料理を出す店を開ける。回転が速く、知名度がそのまま客足になる。' },
  { id: 'fashion', name: 'アパレル', icon: 'icon_facility_textile_factory', branch: 'management', cost: 1800, requires: ['retail', 'marketing'], effects: [{ type: 'unlock', text: 'アパレル店' }], description: '服を売る店を開ける。ブランド価値がそのまま値札に乗る。' },
  { id: 'chain_retail', name: 'チェーン展開', icon: 'icon_commercial_supermarket', branch: 'management', cost: 2500, requires: ['retail', 'logistics_ai'], effects: [{ type: 'unlock', text: 'コンビニ・スーパー' }, { type: 'shopSales', mult: 1.1 }], description: '多店舗をまわす仕組み。お店の売値 +10%。' },
  { id: 'gemology', name: '宝石学', icon: 'icon_resource_gem', branch: 'management', cost: 12000, requires: ['chain_retail', 'gem_cutting'], effects: [{ type: 'unlock', text: '宝石店' }], description: '宝石と貴金属を扱う店を開ける。1点の値段が桁違い。' },
  { id: 'hospitality', name: 'ホスピタリティ', icon: 'icon_commercial_hotel', branch: 'management', cost: 20000, requires: ['chain_retail', 'food_service'], effects: [{ type: 'unlock', text: 'ホテル' }], description: '泊まってもらう商売ができる。立地と知名度で埋まり具合が決まる。' },
  { id: 'gaming_license', name: '遊技場の許可', icon: 'icon_ui_star', branch: 'management', cost: 120000, requires: ['hospitality', 'banking'], effects: [{ type: 'unlock', text: 'カジノ・宝くじ' }], description: '賭場と宝くじを扱えるようになる。客が落とす額は大きいが、評判も重い。' },
  { id: 'advertising', name: '広告技術', icon: 'icon_ui_chart_trend', branch: 'management', cost: 800, requires: ['retail'], effects: [{ type: 'unlock', text: '広告代理店・ネット広告' }], description: 'ネット広告を出せるようになり、広告代理店も始められる。' },
  { id: 'outdoor_ads', name: '屋外広告', icon: 'icon_ui_location', branch: 'management', cost: 3000, requires: ['advertising'], effects: [{ type: 'unlock', text: '屋外看板' }], description: '持っている土地に看板を立てられる。効きは強く、費用も高い。' },
  { id: 'brand_strategy', name: 'ブランド戦略', icon: 'icon_ui_medal', branch: 'management', cost: 6000, requires: ['advertising', 'quality'], effects: [{ type: 'brandGain', mult: 1.5 }], description: 'ブランド価値の上がり方 +50%。' },
  { id: 'market_research', name: '市場調査', icon: 'icon_office_dashboard', branch: 'management', cost: 4000, requires: ['marketing'], effects: [{ type: 'awarenessGain', mult: 1.3 }, { type: 'adCost', mult: 0.9 }], description: '知名度の上がり方 +30%、広告費 -10%。' },
  { id: 'mass_media', name: 'マスメディア', icon: 'icon_ui_star', branch: 'management', cost: 25000, requires: ['outdoor_ads', 'market_research'], effects: [{ type: 'unlock', text: 'テレビCM・メディア会社' }], description: 'テレビCMを打てるようになり、メディア会社も始められる。' },
  { id: 'entertainment', name: 'エンターテインメント', icon: 'icon_ui_star', branch: 'management', cost: 40000, requires: ['mass_media'], effects: [{ type: 'unlock', text: '音楽・映像' }], description: '音楽や映像を作って届ける会社を始められる。' },
  { id: 'studio_ops', name: 'スタジオ運営', icon: 'icon_ui_star', branch: 'management', cost: 60000, requires: ['entertainment'], effects: [{ type: 'productRevenue', mult: 1.15 }], description: '自前のスタジオを回せる。製品の収入 +15%。' },
  { id: 'computing', name: '計算機科学', icon: 'icon_office_dashboard', branch: 'tech', cost: 300, requires: ['accounting'], effects: [{ type: 'researchRate', mult: 1.1 }], description: '計算の基礎。研究ポイント +10%。情報の枝の入口。' },
  { id: 'software', name: 'ソフトウェア工学', icon: 'icon_office_dashboard', branch: 'tech', cost: 800, requires: ['computing'], effects: [{ type: 'unlock', text: 'IT会社' }], description: 'IT会社を始められる。ホームページ制作から社内システムまで請け負える。' },
  { id: 'networking', name: 'ネットワーク', icon: 'icon_commercial_telecom', branch: 'tech', cost: 2000, requires: ['software'], effects: [{ type: 'devSpeed', mult: 1.1 }], description: 'つなぐ技術。事業の仕事量 +10%。' },
  { id: 'cybersecurity', name: '情報セキュリティ', icon: 'icon_ui_lock', branch: 'tech', cost: 6000, requires: ['networking'], effects: [{ type: 'unlock', text: 'セキュリティソフト開発' }], description: '守る技術。自社製のセキュリティソフトを作って売れる。' },
  { id: 'datacenter', name: 'データセンター', icon: 'icon_commercial_datacenter', branch: 'tech', cost: 30000, requires: ['networking', 'grid'], effects: [{ type: 'unlock', text: 'データセンター設計・クラウド運用' }], description: '大規模なサーバー設備を設計・運用できる。' },
  { id: 'mobile', name: 'モバイル', icon: 'icon_ui_company', branch: 'tech', cost: 2500, requires: ['software'], effects: [{ type: 'unlock', text: 'アプリ会社' }], description: 'アプリ会社を始められる。' },
  { id: 'social', name: 'SNS', icon: 'icon_ui_chart_trend', branch: 'tech', cost: 12000, requires: ['mobile', 'marketing'], effects: [{ type: 'unlock', text: 'SNSの開発' }, { type: 'awarenessGain', mult: 1.2 }], description: '人が集まる場所を作れる。知名度の上がり方 +20%。' },
  { id: 'recommendation', name: '推薦技術', icon: 'icon_office_dashboard', branch: 'tech', cost: 45000, requires: ['social'], effects: [{ type: 'productRevenue', mult: 1.2 }], description: '利用者に合うものを出せる。製品の収入 +20%。' },
  { id: 'monetization', name: '課金設計', icon: 'icon_office_coins', branch: 'tech', cost: 30000, requires: ['social'], effects: [{ type: 'productRevenue', mult: 1.15 }], description: '売り方を整える。製品の収入 +15%。' },
  { id: 'graphics', name: 'グラフィックス', icon: 'icon_ui_star', branch: 'tech', cost: 1500, requires: ['computing'], effects: [], description: '描く技術。ゲーム開発の前提。' },
  { id: 'game_dev', name: 'ゲーム開発', icon: 'icon_ui_star', branch: 'tech', cost: 3000, requires: ['graphics'], effects: [{ type: 'unlock', text: 'ゲーム会社' }], description: 'ゲーム会社を始められる。' },
  { id: 'game_engine', name: 'ゲームエンジン', icon: 'icon_part_robot_arm', branch: 'tech', cost: 15000, requires: ['game_dev', 'software'], effects: [{ type: 'devSpeed', mult: 1.2 }], description: '自前のエンジンを持つ。事業の仕事量 +20%。大型タイトルを作れる。' },
  { id: 'live_ops', name: '運営技術', icon: 'icon_ui_time', branch: 'tech', cost: 25000, requires: ['game_engine'], effects: [{ type: 'unlock', text: '運営（アップデート）' }], description: '出したあとも手を入れて、離れた利用者を呼び戻せる。' },
  { id: 'esports', name: 'eスポーツ', icon: 'icon_ui_medal', branch: 'tech', cost: 60000, requires: ['live_ops', 'mass_media'], effects: [{ type: 'awarenessGain', mult: 1.4 }], description: '大会を開ける。知名度の上がり方 +40%。' },
  { id: 'gpu_fab', name: 'GPU量産', icon: 'icon_part_gpu', branch: 'tech', cost: 90000, requires: ['gpu_design'], effects: [{ type: 'unlock', text: 'GPUの製造と市場での売買' }], description: 'GPUを自社で量産できる。市場から仕入れて転売もできるようになる。' },
  { id: 'crypto_mining', name: '暗号資産マイニング', icon: 'icon_product_crypto', branch: 'tech', cost: 140000, requires: ['gpu_fab', 'datacenter'], effects: [{ type: 'unlock', text: 'マイニング装置' }], description: 'GPUを並べて暗号資産を掘れる。電気を食い、GPUは焼けて減る。相場の上下がそのまま儲けと損になる。' },
  { id: 'card_market', name: 'カード相場', icon: 'icon_card_pack', branch: 'service', cost: 9000, requires: ['commerce'], effects: [{ type: 'unlock', text: 'トレーディングカードの売買とパック開封' }], description: 'トレーディングカードを扱えるようになる。パックを開けて集め、値上がりしたものを売る。' },
  { id: 'ai', name: '人工知能', icon: 'icon_part_robot_arm', branch: 'tech', cost: 200000, requires: ['recommendation', 'robotics'], effects: [{ type: 'devSpeed', mult: 1.4 }, { type: 'researchRate', mult: 1.3 }], description: '考える機械。事業の仕事量 +40%、研究ポイント +30%。' },
  { id: 'education', name: '教育事業', icon: 'icon_ui_research', branch: 'service', cost: 8000, requires: ['accounting', 'computing'], effects: [{ type: 'unlock', text: '教育事業' }, { type: 'researchRate', mult: 1.15 }], description: '塾や学校をつくれる。研究ポイント +15%。' },
  { id: 'higher_education', name: '高等教育', icon: 'icon_ui_research', branch: 'service', cost: 60000, requires: ['education'], effects: [{ type: 'researchRate', mult: 1.25 }], description: '専門学校をつくれる。研究ポイント +25%。' },
  { id: 'healthcare', name: '医療', icon: 'icon_ui_medal', branch: 'service', cost: 15000, requires: ['education', 'chemistry'], effects: [{ type: 'unlock', text: '医療法人' }], description: '診療所や病院を開ける。地域に必要とされる商売。' },
  { id: 'hospital', name: '総合病院', icon: 'icon_commercial_hospital', branch: 'service', cost: 80000, requires: ['healthcare', 'pharmaceutics'], effects: [{ type: 'brandGain', mult: 1.2 }], description: '大きな病院を運営できる。ブランドの上がり方 +20%。' },
  { id: 'staffing_business', name: '人材サービス', icon: 'icon_facility_worker', branch: 'service', cost: 5000, requires: ['hr'], effects: [{ type: 'unlock', text: '人材サービス' }, { type: 'wage', mult: 0.95 }], description: '人を集めて送り出す会社。自社の人件費も -5%。' },
  { id: 'security_business', name: '警備業', icon: 'icon_ui_lock', branch: 'service', cost: 3000, requires: ['hr'], effects: [{ type: 'unlock', text: '警備会社' }], description: '施設や現場を守る会社を始められる。' },
  { id: 'banking', name: '銀行業', icon: 'icon_commercial_bank', branch: 'service', cost: 40000, requires: ['accounting', 'commerce'], effects: [{ type: 'unlock', text: '銀行' }], description: 'お金を預かって貸せるようになる。' },
  { id: 'retail_banking', name: '個人向け金融', icon: 'icon_office_coins', branch: 'service', cost: 90000, requires: ['banking'], effects: [], description: '住宅ローンなど、個人向けの商品を扱える。' },
  { id: 'investment_banking', name: '投資銀行', icon: 'icon_ui_chart_trend', branch: 'service', cost: 300000, requires: ['retail_banking', 'securities_business'], effects: [], description: '会社の合併や上場を手伝える。当たれば桁が変わる。' },
  { id: 'securities_business', name: '証券業', icon: 'icon_ui_chart_trend', branch: 'service', cost: 120000, requires: ['banking', 'marketing'], effects: [{ type: 'unlock', text: '証券会社' }], description: '株の売買を取り次ぐ会社を始められる。' },
  { id: 'insurance_business', name: '保険業', icon: 'icon_office_documents', branch: 'service', cost: 150000, requires: ['banking', 'quality'], effects: [{ type: 'unlock', text: '保険会社' }], description: '万一に備える商品を売る会社を始められる。' },
] as const satisfies readonly ResearchDef[];

export type ResearchId = (typeof RESEARCH)[number]['id'];
export const RESEARCH_MAP: Record<ResearchId, ResearchDef> = Object.fromEntries(RESEARCH.map((r) => [r.id, r])) as unknown as Record<ResearchId, ResearchDef>;

export function isResearchId(id: string): id is ResearchId {
  return id in RESEARCH_MAP;
}
