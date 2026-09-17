/**
 * 案件（しごと）。IT・パソコン・ゲーム・アプリ・広告の会社が受けたり作ったりするもの。
 *
 * 進め方は共通で、
 *   1. 案件を選んで始める（着手金がかかることもある）
 *   2. 従業員の仕事量が溜まっていく
 *   3. 完成すると、報酬・ブランド・知名度・研究ポイントが入る
 *   4. 「製品」になる案件は、そのあと利用者から毎秒お金が入り続ける（飽きられると減る）
 */
import type { BusinessKindId } from './business';
import type { ResourceId } from './resources';

export interface ProductDef {
  /** 発売直後の利用者数（人）。知名度とブランドで増える */
  baseUsers: number;
  /** 利用者1人が1秒あたりに落とすお金（円） */
  revenuePerUser: number;
  /** 1時間あたりに利用者が減る割合（飽きられる速さ） */
  decayPerHour: number;
  /** 運用に要る人数 */
  upkeepStaff: number;
}

export interface ProjectDef {
  id: string;
  business: BusinessKindId;
  name: string;
  icon: string;
  /** 解放に必要な研究（なければ事業を開いた時点で受けられる） */
  research?: string;
  /** 始めるのにかかるお金（円） */
  startCost: number;
  /** 完成に必要な仕事量（人 × 秒） */
  work: number;
  /** 作るのに要る材料（パソコンなど、物を作る案件） */
  inputs?: Partial<Record<ResourceId, number>>;
  /** 完成したときの報酬（円） */
  reward: number;
  /** 完成したときに上がるブランド価値 */
  brand: number;
  /** 完成したときに上がる知名度 */
  awareness: number;
  /** 完成したときに入る研究ポイント */
  research_points: number;
  /** 発売して続けて稼ぐ製品になるなら、その内容 */
  product?: ProductDef;
  description: string;
}

export const PROJECTS = [
  // ---- IT会社 ----
  { id: 'it_homepage', business: 'it', name: 'ホームページ制作', icon: 'icon_office_documents', startCost: 0, work: 600, reward: 250_000, brand: 1, awareness: 1.5, research_points: 2, description: '小さな会社のホームページを作る。実績づくりにちょうどいい。' },
  { id: 'it_inhouse', business: 'it', name: '社内システム開発', icon: 'icon_office_dashboard', startCost: 200_000, work: 2_400, reward: 1_600_000, brand: 3, awareness: 2, research_points: 6, description: '受注や在庫を管理する仕組みを作る。地味だが確実に稼げる。' },
  { id: 'it_security', business: 'it', name: 'セキュリティソフト開発', icon: 'icon_ui_lock', research: 'cybersecurity', startCost: 1_500_000, work: 12_000, reward: 6_000_000, brand: 8, awareness: 6, research_points: 25, product: { baseUsers: 4_000, revenuePerUser: 0.004, decayPerHour: 0.03, upkeepStaff: 3 }, description: '自社製のセキュリティソフトを作って売る。契約が続くかぎり収入になる。' },
  { id: 'it_datacenter', business: 'it', name: 'データセンター設計', icon: 'icon_commercial_datacenter', research: 'datacenter', startCost: 6_000_000, work: 36_000, reward: 28_000_000, brand: 14, awareness: 8, research_points: 60, description: '大規模なサーバー設備を設計する。電力と冷却の知識が要る大仕事。' },
  { id: 'it_cloud', business: 'it', name: 'クラウド基盤の運用', icon: 'icon_commercial_datacenter', research: 'datacenter', startCost: 12_000_000, work: 60_000, reward: 20_000_000, brand: 18, awareness: 12, research_points: 90, product: { baseUsers: 20_000, revenuePerUser: 0.006, decayPerHour: 0.012, upkeepStaff: 10 }, description: '他社のシステムを預かって動かし続ける。止めないかぎり毎秒お金が入る。' },

  // ---- パソコン製造 ----
  { id: 'pc_budget', business: 'pc', name: '普及価格帯のPC開発', icon: 'icon_material_semiconductor', startCost: 1_000_000, work: 6_000, inputs: { electronics: 40, plastic: 60, wire: 40 }, reward: 3_500_000, brand: 3, awareness: 3, research_points: 12, product: { baseUsers: 6_000, revenuePerUser: 0.003, decayPerHour: 0.05, upkeepStaff: 2 }, description: 'とにかく安く作って数を出す。利益は薄いが、名前が広まる。' },
  { id: 'pc_cost_cut', business: 'pc', name: 'コスト削減の研究', icon: 'icon_ui_chart', startCost: 2_000_000, work: 9_000, reward: 1_000_000, brand: 2, awareness: 1, research_points: 35, description: '部品と工程を見直して、作る値段を下げる。すぐには儲からないが後で効く。' },
  { id: 'pc_material', business: 'pc', name: '新素材の試作', icon: 'icon_material_steel', research: 'new_materials', startCost: 5_000_000, work: 20_000, inputs: { steel: 30, chemical: 40 }, reward: 2_500_000, brand: 6, awareness: 3, research_points: 80, description: '新しい基板と筐体の素材を試す。うまくいけば次の機種が一段良くなる。' },
  { id: 'pc_performance', business: 'pc', name: '高性能機の開発', icon: 'icon_part_robot_arm', research: 'gpu_design', startCost: 15_000_000, work: 48_000, inputs: { semiconductor: 30, electronics: 120, steel: 60 }, reward: 40_000_000, brand: 16, awareness: 12, research_points: 120, product: { baseUsers: 9_000, revenuePerUser: 0.012, decayPerHour: 0.045, upkeepStaff: 5 }, description: '処理能力を大きく上げた機種を出す。高く売れて、名前も一気に知られる。' },
  { id: 'pc_workstation', business: 'pc', name: '業務用ワークステーション', icon: 'icon_commercial_datacenter', research: 'gpu_design', startCost: 30_000_000, work: 90_000, inputs: { semiconductor: 80, electronics: 200, steel: 150 }, reward: 120_000_000, brand: 22, awareness: 10, research_points: 200, product: { baseUsers: 3_000, revenuePerUser: 0.05, decayPerHour: 0.02, upkeepStaff: 8 }, description: '企業向けの高価な機種。台数は出ないが、1台あたりの利益が大きい。' },

  // ---- ゲーム会社 ----
  { id: 'game_idea', business: 'game', name: '企画を練る', icon: 'icon_ui_star', startCost: 0, work: 900, reward: 0, brand: 1, awareness: 0.5, research_points: 8, description: 'アイデアを固める。お金にはならないが、次の開発が軽くなる。' },
  { id: 'game_indie', business: 'game', name: '小規模タイトルの開発', icon: 'icon_ui_star', startCost: 300_000, work: 4_000, reward: 1_200_000, brand: 4, awareness: 4, research_points: 10, product: { baseUsers: 3_000, revenuePerUser: 0.002, decayPerHour: 0.08, upkeepStaff: 1 }, description: '小さく作って出す。当たれば一気に名前が広まる。' },
  { id: 'game_console', business: 'game', name: '大型タイトルの開発', icon: 'icon_ui_star', research: 'game_engine', startCost: 8_000_000, work: 40_000, reward: 25_000_000, brand: 15, awareness: 14, research_points: 70, product: { baseUsers: 25_000, revenuePerUser: 0.004, decayPerHour: 0.06, upkeepStaff: 6 }, description: '腰を据えて作る看板タイトル。出来がよければ会社の顔になる。' },
  { id: 'game_live', business: 'game', name: '運営（アップデート）', icon: 'icon_ui_time', research: 'live_ops', startCost: 1_000_000, work: 6_000, reward: 0, brand: 5, awareness: 4, research_points: 15, description: '出したタイトルに手を入れて、離れた利用者を呼び戻す。既存の製品の利用者が回復する。' },
  { id: 'game_esports', business: 'game', name: 'eスポーツ大会の開催', icon: 'icon_ui_medal', research: 'esports', startCost: 20_000_000, work: 24_000, reward: 6_000_000, brand: 20, awareness: 25, research_points: 40, description: '大会を開いて盛り上げる。赤字になりがちだが、知名度が跳ね上がる。' },

  // ---- アプリ会社 ----
  { id: 'app_utility', business: 'app', name: '便利アプリの開発', icon: 'icon_ui_company', startCost: 100_000, work: 1_800, reward: 600_000, brand: 2, awareness: 2, research_points: 6, product: { baseUsers: 5_000, revenuePerUser: 0.0008, decayPerHour: 0.06, upkeepStaff: 1 }, description: '小さくて役に立つアプリ。広告収入が少しずつ入る。' },
  { id: 'app_sns', business: 'app', name: 'SNSの開発', icon: 'icon_ui_chart_trend', research: 'social', startCost: 4_000_000, work: 24_000, reward: 2_000_000, brand: 12, awareness: 20, research_points: 50, product: { baseUsers: 60_000, revenuePerUser: 0.0006, decayPerHour: 0.015, upkeepStaff: 8 }, description: '人が集まる場所を作る。利用者が利用者を呼ぶので、育つと止まらない。' },
  { id: 'app_recommend', business: 'app', name: '推薦アルゴリズムの改良', icon: 'icon_office_dashboard', research: 'recommendation', startCost: 8_000_000, work: 30_000, reward: 0, brand: 8, awareness: 5, research_points: 110, description: '利用者に合うものを出せるようにする。すべての製品の収入が上がる。' },
  { id: 'app_payments', business: 'app', name: '課金の仕組みづくり', icon: 'icon_office_coins', research: 'monetization', startCost: 6_000_000, work: 20_000, reward: 1_000_000, brand: 6, awareness: 3, research_points: 70, description: '売り方を整える。作った製品の1人あたりの収入が上がる。' },

  // ---- 広告代理店 ----
  { id: 'ad_campaign', business: 'agency', name: '他社の広告を請け負う', icon: 'icon_ui_chart_trend', startCost: 500_000, work: 3_000, reward: 2_500_000, brand: 3, awareness: 2, research_points: 5, description: 'よその会社の広告をまとめて引き受ける。手堅い商売。' },
  { id: 'ad_brand', business: 'agency', name: 'ブランド戦略の立案', icon: 'icon_ui_medal', research: 'brand_strategy', startCost: 3_000_000, work: 12_000, reward: 9_000_000, brand: 10, awareness: 6, research_points: 30, description: '看板の作り方から売り方まで丸ごと設計する。自社のブランドも上がる。' },
  { id: 'ad_national', business: 'agency', name: '全国キャンペーン', icon: 'icon_ui_star', research: 'mass_media', startCost: 25_000_000, work: 45_000, reward: 70_000_000, brand: 18, awareness: 18, research_points: 60, description: 'テレビも新聞もネットもまとめて押さえる大仕事。' },

  // ---- 運送会社 ----
  { id: 'tr_local', business: 'transport', name: '近距離の配送を請け負う', icon: 'icon_logistics_truck', startCost: 200_000, work: 2_000, reward: 1_200_000, brand: 2, awareness: 2, research_points: 4, description: '町なかの配送をまとめて引き受ける。すぐ現金になる。' },
  { id: 'tr_route', business: 'transport', name: '定期便の路線を開く', icon: 'icon_logistics_train', startCost: 3_000_000, work: 12_000, reward: 2_000_000, brand: 6, awareness: 4, research_points: 20, product: { baseUsers: 900, revenuePerUser: 0.02, decayPerHour: 0.01, upkeepStaff: 5 }, description: '毎日走る路線を作る。荷主が付くかぎり、走らせるだけでお金が入る。' },
  { id: 'tr_cold', business: 'transport', name: '冷蔵輸送を始める', icon: 'icon_logistics_truck', research: 'cold_chain', startCost: 8_000_000, work: 24_000, reward: 6_000_000, brand: 10, awareness: 5, research_points: 45, product: { baseUsers: 700, revenuePerUser: 0.05, decayPerHour: 0.008, upkeepStaff: 8 }, description: '食品や薬を冷やしたまま運ぶ。単価が高く、取り合いも少ない。' },
  { id: 'tr_port', business: 'transport', name: '港湾ターミナルの運営', icon: 'icon_logistics_container_crane', research: 'port_ops', startCost: 40_000_000, work: 70_000, reward: 25_000_000, brand: 18, awareness: 10, research_points: 120, product: { baseUsers: 2_500, revenuePerUser: 0.06, decayPerHour: 0.005, upkeepStaff: 20 }, description: '港のコンテナ基地を任される。国際物流の要になる。' },

  // ---- 建設会社 ----
  { id: 'cs_house', business: 'construction', name: '住宅を建てる', icon: 'icon_machine_tower_crane', startCost: 500_000, work: 3_000, inputs: { lumber: 120, brick: 80, concrete: 60 }, reward: 3_500_000, brand: 3, awareness: 2, research_points: 6, description: '一戸建てを請け負う。木材とれんが、コンクリートが要る。' },
  { id: 'cs_building', business: 'construction', name: 'ビルを建てる', icon: 'icon_machine_tower_crane', research: 'structural', startCost: 6_000_000, work: 20_000, inputs: { steel: 400, concrete: 800, glass: 200 }, reward: 30_000_000, brand: 10, awareness: 6, research_points: 40, description: '街なかの中層ビル。鋼材とコンクリートを大量に使う。' },
  { id: 'cs_infra', business: 'construction', name: '道路と橋をかける', icon: 'icon_machine_excavator', research: 'civil_works', startCost: 20_000_000, work: 45_000, inputs: { concrete: 2_000, steel: 900 }, reward: 90_000_000, brand: 16, awareness: 12, research_points: 90, description: '公共の仕事。額が大きく、地域での名前も一気に広がる。' },
  { id: 'cs_skyscraper', business: 'construction', name: '超高層ビルを建てる', icon: 'icon_machine_tower_crane', research: 'skyscraper', startCost: 120_000_000, work: 140_000, inputs: { steel: 5_000, concrete: 6_000, glass: 2_000, machine_parts: 800 }, reward: 600_000_000, brand: 30, awareness: 25, research_points: 250, description: '街の景色を変える一棟。完成すれば会社の名前が残る。' },

  // ---- 銀行 ----
  { id: 'bk_loan', business: 'bank', name: '中小企業へ融資する', icon: 'icon_office_coins', startCost: 20_000_000, work: 8_000, reward: 4_000_000, brand: 4, awareness: 2, research_points: 15, product: { baseUsers: 1_200, revenuePerUser: 0.03, decayPerHour: 0.006, upkeepStaff: 6 }, description: '地元の会社にお金を貸す。返ってくるかぎり、利息が入り続ける。' },
  { id: 'bk_mortgage', business: 'bank', name: '住宅ローンを扱う', icon: 'icon_office_coins', research: 'retail_banking', startCost: 60_000_000, work: 20_000, reward: 8_000_000, brand: 8, awareness: 6, research_points: 45, product: { baseUsers: 5_000, revenuePerUser: 0.02, decayPerHour: 0.003, upkeepStaff: 12 }, description: '家を買う人に長く貸す。焦げ付きにくく、細く長く稼ぐ。' },
  { id: 'bk_invest', business: 'bank', name: '投資銀行業務', icon: 'icon_ui_chart_trend', research: 'investment_banking', startCost: 200_000_000, work: 60_000, reward: 150_000_000, brand: 20, awareness: 12, research_points: 150, product: { baseUsers: 900, revenuePerUser: 0.35, decayPerHour: 0.02, upkeepStaff: 25 }, description: '会社の合併や上場を手伝う。当たれば桁が変わるが、波も大きい。' },

  // ---- メディア会社 ----
  { id: 'md_program', business: 'media', name: '番組を制作する', icon: 'icon_ui_star', startCost: 2_000_000, work: 8_000, reward: 6_000_000, brand: 6, awareness: 10, research_points: 15, description: '番組を作って流す。自社の名前がそのまま広まる。' },
  { id: 'md_news', business: 'media', name: 'ニュースサイトの運営', icon: 'icon_office_documents', startCost: 5_000_000, work: 15_000, reward: 2_000_000, brand: 8, awareness: 14, research_points: 30, product: { baseUsers: 40_000, revenuePerUser: 0.0007, decayPerHour: 0.02, upkeepStaff: 6 }, description: '記事を出し続ける。読者がいるかぎり広告収入が入る。' },
  { id: 'md_studio', business: 'media', name: '映像スタジオを持つ', icon: 'icon_ui_star', research: 'studio_ops', startCost: 30_000_000, work: 40_000, reward: 40_000_000, brand: 18, awareness: 20, research_points: 80, product: { baseUsers: 8_000, revenuePerUser: 0.02, decayPerHour: 0.015, upkeepStaff: 15 }, description: '自前のスタジオで作る。他社の撮影も受けられる。' },

  // ---- 医療法人 ----
  { id: 'cl_clinic', business: 'clinic', name: '診療所を開く', icon: 'icon_ui_medal', startCost: 5_000_000, work: 6_000, reward: 1_000_000, brand: 6, awareness: 8, research_points: 20, product: { baseUsers: 2_000, revenuePerUser: 0.02, decayPerHour: 0.004, upkeepStaff: 6 }, description: '地域のかかりつけになる。通う人がいるかぎり安定して入る。' },
  { id: 'cl_hospital', business: 'clinic', name: '総合病院を建てる', icon: 'icon_ui_medal', research: 'hospital', startCost: 80_000_000, work: 60_000, inputs: { machine_parts: 400, electronics: 600 }, reward: 20_000_000, brand: 20, awareness: 18, research_points: 130, product: { baseUsers: 12_000, revenuePerUser: 0.03, decayPerHour: 0.002, upkeepStaff: 30 }, description: '大きな病院を運営する。地域になくてはならない存在になる。' },

  // ---- 教育事業 ----
  { id: 'ed_cram', business: 'school', name: '塾を開く', icon: 'icon_ui_research', startCost: 2_000_000, work: 4_000, reward: 800_000, brand: 4, awareness: 6, research_points: 25, product: { baseUsers: 1_500, revenuePerUser: 0.012, decayPerHour: 0.01, upkeepStaff: 4 }, description: '子どもたちに教える。月謝が毎月入り、街での評判も上がる。' },
  { id: 'ed_college', business: 'school', name: '専門学校をつくる', icon: 'icon_ui_research', research: 'higher_education', startCost: 40_000_000, work: 35_000, reward: 5_000_000, brand: 14, awareness: 12, research_points: 160, product: { baseUsers: 6_000, revenuePerUser: 0.02, decayPerHour: 0.004, upkeepStaff: 20 }, description: '技術者を育てる学校。卒業生が増えるほど、自社の研究も進む。' },

  // ---- 食品メーカー ----
  { id: 'fd_snack', business: 'foodmaker', name: '新しいお菓子の開発', icon: 'icon_food_bread', startCost: 300_000, work: 2_500, inputs: { wheat: 200, food: 50 }, reward: 1_800_000, brand: 3, awareness: 4, research_points: 8, product: { baseUsers: 8_000, revenuePerUser: 0.0012, decayPerHour: 0.05, upkeepStaff: 2 }, description: '売り場に並ぶ商品を作る。当たると全国のお店に置かれる。' },
  { id: 'fd_frozen', business: 'foodmaker', name: '冷凍食品のライン', icon: 'icon_facility_food_factory', research: 'cold_chain', startCost: 4_000_000, work: 14_000, inputs: { food: 400, plastic: 200 }, reward: 9_000_000, brand: 7, awareness: 5, research_points: 30, product: { baseUsers: 15_000, revenuePerUser: 0.0015, decayPerHour: 0.02, upkeepStaff: 6 }, description: '冷やして運ぶ商品。日持ちがして、長く売れ続ける。' },
  { id: 'fd_brand', business: 'foodmaker', name: '看板商品を育てる', icon: 'icon_ui_medal', research: 'brand_strategy', startCost: 10_000_000, work: 28_000, reward: 6_000_000, brand: 16, awareness: 12, research_points: 60, description: 'ひとつの商品を磨き上げて、会社の顔にする。' },

  // ---- 家電メーカー ----
  { id: 'ap_fridge', business: 'appliance', name: '冷蔵庫の開発', icon: 'icon_material_electronics', startCost: 2_000_000, work: 8_000, inputs: { steel: 150, electronics: 80, plastic: 120 }, reward: 8_000_000, brand: 4, awareness: 4, research_points: 15, product: { baseUsers: 5_000, revenuePerUser: 0.004, decayPerHour: 0.03, upkeepStaff: 3 }, description: '家庭に1台。壊れにくさがそのまま評判になる。' },
  { id: 'ap_tv', business: 'appliance', name: '薄型テレビの開発', icon: 'icon_material_electronics', startCost: 6_000_000, work: 18_000, inputs: { electronics: 300, glass: 200, semiconductor: 20 }, reward: 22_000_000, brand: 8, awareness: 8, research_points: 40, product: { baseUsers: 9_000, revenuePerUser: 0.005, decayPerHour: 0.04, upkeepStaff: 5 }, description: '画面の美しさで選ばれる商品。' },
  { id: 'ap_smart', business: 'appliance', name: 'スマート家電', icon: 'icon_part_robot_arm', research: 'networking', startCost: 20_000_000, work: 40_000, inputs: { semiconductor: 60, electronics: 500, battery: 100 }, reward: 60_000_000, brand: 15, awareness: 12, research_points: 90, product: { baseUsers: 20_000, revenuePerUser: 0.006, decayPerHour: 0.025, upkeepStaff: 10 }, description: 'つながる家電。売ったあとも使い続けてもらえる。' },

  // ---- 自動車メーカー ----
  { id: 'au_compact', business: 'automaker', name: '小型車の開発', icon: 'icon_facility_vehicle_factory', startCost: 20_000_000, work: 40_000, inputs: { steel: 800, tire: 200, electronics: 300, glass: 200 }, reward: 80_000_000, brand: 8, awareness: 8, research_points: 50, product: { baseUsers: 12_000, revenuePerUser: 0.02, decayPerHour: 0.03, upkeepStaff: 10 }, description: '売れ筋の1台。台数が出るので工場が回る。' },
  { id: 'au_ev', business: 'automaker', name: '電気自動車の開発', icon: 'icon_material_battery', research: 'storage_battery', startCost: 80_000_000, work: 100_000, inputs: { battery: 400, steel: 1_200, electronics: 800, semiconductor: 60 }, reward: 300_000_000, brand: 20, awareness: 18, research_points: 150, product: { baseUsers: 18_000, revenuePerUser: 0.04, decayPerHour: 0.02, upkeepStaff: 20 }, description: '電池で走る車。時代の顔になる。' },
  { id: 'au_luxury', business: 'automaker', name: '高級車ブランド', icon: 'icon_ui_crown', research: 'brand_strategy', startCost: 200_000_000, work: 160_000, inputs: { steel: 2_000, leather: 600, electronics: 1_500, gem: 20 }, reward: 800_000_000, brand: 30, awareness: 20, research_points: 220, product: { baseUsers: 4_000, revenuePerUser: 0.25, decayPerHour: 0.012, upkeepStaff: 25 }, description: '台数は出ないが、1台の利益が桁違い。' },

  // ---- 製薬 ----
  { id: 'ph_generic', business: 'pharma', name: '後発薬をつくる', icon: 'icon_facility_chemical_plant', startCost: 8_000_000, work: 15_000, inputs: { chemical: 400 }, reward: 20_000_000, brand: 4, awareness: 3, research_points: 40, product: { baseUsers: 8_000, revenuePerUser: 0.008, decayPerHour: 0.01, upkeepStaff: 5 }, description: '特許の切れた薬を安く作る。堅実な商売。' },
  { id: 'ph_newdrug', business: 'pharma', name: '新薬の開発', icon: 'icon_facility_chemical_plant', research: 'healthcare', startCost: 100_000_000, work: 180_000, inputs: { chemical: 3_000 }, reward: 400_000_000, brand: 25, awareness: 15, research_points: 300, product: { baseUsers: 12_000, revenuePerUser: 0.08, decayPerHour: 0.004, upkeepStaff: 25 }, description: '長い時間と大金がかかるが、通れば何年も売れ続ける。' },

  // ---- 造船 ----
  { id: 'sy_cargo', business: 'shipyard', name: '貨物船を建造', icon: 'icon_logistics_ship', startCost: 40_000_000, work: 60_000, inputs: { steel: 6_000, machine_parts: 800 }, reward: 200_000_000, brand: 10, awareness: 6, research_points: 60, description: '鋼の塊を海に浮かべる。1隻で工場が数か月回る。' },
  { id: 'sy_tanker', business: 'shipyard', name: 'タンカーを建造', icon: 'icon_logistics_ship', research: 'port_ops', startCost: 150_000_000, work: 140_000, inputs: { steel: 18_000, machine_parts: 2_000, wire: 1_500 }, reward: 700_000_000, brand: 18, awareness: 10, research_points: 140, description: '原油を運ぶ巨大な船。造れる会社は限られる。' },

  // ---- 航空機メーカー ----
  { id: 'as_parts', business: 'aerospace', name: '機体部品の量産', icon: 'icon_logistics_airplane', startCost: 60_000_000, work: 70_000, inputs: { steel: 3_000, electronics: 1_500 }, reward: 250_000_000, brand: 12, awareness: 6, research_points: 120, description: 'よその機体に載る部品を作る。まずはここから。' },
  { id: 'as_jet', business: 'aerospace', name: '旅客機の開発', icon: 'icon_logistics_airplane', research: 'aerospace', startCost: 800_000_000, work: 400_000, inputs: { steel: 30_000, semiconductor: 800, electronics: 12_000, machine_parts: 6_000 }, reward: 4_000_000_000, brand: 35, awareness: 25, research_points: 500, product: { baseUsers: 800, revenuePerUser: 2.5, decayPerHour: 0.006, upkeepStaff: 60 }, description: '最も難しい製造。完成すれば世界の空を飛ぶ。' },

  // ---- 鉄道会社 ----
  { id: 'rw_line', business: 'railway', name: '路線を1本ひらく', icon: 'icon_logistics_train', startCost: 100_000_000, work: 80_000, inputs: { steel: 8_000, concrete: 12_000 }, reward: 30_000_000, brand: 14, awareness: 12, research_points: 100, product: { baseUsers: 30_000, revenuePerUser: 0.004, decayPerHour: 0.002, upkeepStaff: 30 }, description: '敷いてしまえば、毎日人と荷物が乗る。' },
  { id: 'rw_station', business: 'railway', name: '駅ビルを建てる', icon: 'icon_commercial_train_station', research: 'structural', startCost: 200_000_000, work: 120_000, inputs: { steel: 5_000, concrete: 9_000, glass: 2_500 }, reward: 120_000_000, brand: 18, awareness: 16, research_points: 150, product: { baseUsers: 15_000, revenuePerUser: 0.02, decayPerHour: 0.002, upkeepStaff: 25 }, description: '駅そのものを商業施設にする。乗る人がそのまま客になる。' },

  // ---- 航空会社 ----
  { id: 'al_domestic', business: 'airline', name: '国内路線を開く', icon: 'icon_logistics_airplane', startCost: 200_000_000, work: 60_000, reward: 40_000_000, brand: 10, awareness: 12, research_points: 80, product: { baseUsers: 20_000, revenuePerUser: 0.012, decayPerHour: 0.02, upkeepStaff: 30 }, description: '短い路線から始める。燃料の値段に振り回される商売。' },
  { id: 'al_intl', business: 'airline', name: '国際線を就航', icon: 'icon_logistics_airplane', research: 'airline_business', startCost: 900_000_000, work: 180_000, reward: 200_000_000, brand: 25, awareness: 25, research_points: 200, product: { baseUsers: 45_000, revenuePerUser: 0.03, decayPerHour: 0.015, upkeepStaff: 70 }, description: '世界とつながる。景気がよければ大きく稼ぐ。' },

  // ---- 不動産会社 ----
  { id: 're_broker', business: 'realestate', name: '仲介を始める', icon: 'icon_commercial_office', startCost: 5_000_000, work: 6_000, reward: 12_000_000, brand: 4, awareness: 4, research_points: 15, description: '売り買いを取り次いで手数料をもらう。' },
  { id: 're_manage', business: 'realestate', name: '物件の管理を請け負う', icon: 'icon_commercial_apartment', startCost: 20_000_000, work: 18_000, reward: 8_000_000, brand: 8, awareness: 5, research_points: 40, product: { baseUsers: 6_000, revenuePerUser: 0.012, decayPerHour: 0.003, upkeepStaff: 10 }, description: '入居者がいるかぎり、管理料が入り続ける。' },
  { id: 're_develop', business: 'realestate', name: '街区を再開発する', icon: 'icon_terrain_city', research: 'civil_works', startCost: 300_000_000, work: 120_000, inputs: { concrete: 15_000, steel: 6_000, glass: 3_000 }, reward: 1_200_000_000, brand: 28, awareness: 20, research_points: 220, description: '一帯をまるごと造りかえる。街の景色が変わる。' },

  // ---- 証券・保険 ----
  { id: 'sc_brokerage', business: 'securities', name: '売買を取り次ぐ', icon: 'icon_ui_chart_trend', startCost: 30_000_000, work: 10_000, reward: 25_000_000, brand: 5, awareness: 4, research_points: 30, product: { baseUsers: 8_000, revenuePerUser: 0.01, decayPerHour: 0.02, upkeepStaff: 8 }, description: '相場が動くほど手数料が入る。' },
  { id: 'sc_fund', business: 'securities', name: 'ファンドを組成する', icon: 'icon_office_coins', research: 'investment_banking', startCost: 300_000_000, work: 60_000, reward: 250_000_000, brand: 18, awareness: 10, research_points: 180, product: { baseUsers: 3_000, revenuePerUser: 0.15, decayPerHour: 0.01, upkeepStaff: 20 }, description: '人からお金を預かって運用する。信用が資本になる。' },
  { id: 'in_life', business: 'insurance', name: '生命保険を売る', icon: 'icon_office_documents', startCost: 50_000_000, work: 20_000, reward: 20_000_000, brand: 6, awareness: 6, research_points: 50, product: { baseUsers: 25_000, revenuePerUser: 0.004, decayPerHour: 0.002, upkeepStaff: 15 }, description: '契約が積み上がるほど、静かに安定していく。' },
  { id: 'in_casualty', business: 'insurance', name: '損害保険を扱う', icon: 'icon_ui_warning', research: 'insurance_business', startCost: 120_000_000, work: 35_000, reward: 60_000_000, brand: 10, awareness: 7, research_points: 90, product: { baseUsers: 18_000, revenuePerUser: 0.008, decayPerHour: 0.004, upkeepStaff: 20 }, description: '災害が多いと払う側に回るが、平時は堅い商売。' },

  // ---- 人材・警備 ----
  { id: 'st_dispatch', business: 'staffing', name: '人を送り出す', icon: 'icon_facility_worker', startCost: 2_000_000, work: 4_000, reward: 3_500_000, brand: 3, awareness: 3, research_points: 10, product: { baseUsers: 2_000, revenuePerUser: 0.01, decayPerHour: 0.015, upkeepStaff: 5 }, description: '人手の足りない現場へ送る。景気がよいほど忙しい。' },
  { id: 'st_recruit', business: 'staffing', name: '採用を請け負う', icon: 'icon_office_documents', research: 'labor', startCost: 15_000_000, work: 16_000, reward: 25_000_000, brand: 8, awareness: 6, research_points: 45, description: '会社の採用をまるごと引き受ける。' },
  { id: 'sec_guard', business: 'security', name: '施設警備を請け負う', icon: 'icon_ui_lock', startCost: 1_500_000, work: 3_000, reward: 3_000_000, brand: 3, awareness: 2, research_points: 8, product: { baseUsers: 1_500, revenuePerUser: 0.012, decayPerHour: 0.004, upkeepStaff: 6 }, description: '切れ目のない仕事。契約が続くかぎり入る。' },
  { id: 'sec_cash', business: 'security', name: '現金輸送を始める', icon: 'icon_logistics_truck', research: 'banking', startCost: 20_000_000, work: 18_000, reward: 18_000_000, brand: 10, awareness: 5, research_points: 50, product: { baseUsers: 900, revenuePerUser: 0.06, decayPerHour: 0.002, upkeepStaff: 12 }, description: '銀行の現金を運ぶ。信用がすべての仕事。' },

  // ---- 音楽・映像 ----
  { id: 'mu_single', business: 'music', name: '一曲つくる', icon: 'icon_ui_star', startCost: 500_000, work: 2_500, reward: 1_500_000, brand: 4, awareness: 8, research_points: 10, product: { baseUsers: 12_000, revenuePerUser: 0.0006, decayPerHour: 0.07, upkeepStaff: 1 }, description: '当たれば一気に広まる。外すと静かに消える。' },
  { id: 'mu_album', business: 'music', name: 'アルバムを出す', icon: 'icon_ui_star', startCost: 4_000_000, work: 12_000, reward: 8_000_000, brand: 10, awareness: 14, research_points: 30, product: { baseUsers: 30_000, revenuePerUser: 0.0008, decayPerHour: 0.03, upkeepStaff: 4 }, description: 'まとめて届ける。長く聴かれると効いてくる。' },
  { id: 'mu_film', business: 'music', name: '映画を制作する', icon: 'icon_ui_star', research: 'studio_ops', startCost: 60_000_000, work: 60_000, reward: 90_000_000, brand: 25, awareness: 30, research_points: 120, product: { baseUsers: 50_000, revenuePerUser: 0.002, decayPerHour: 0.04, upkeepStaff: 15 }, description: '大きな賭け。当たれば会社の名前が世界に出る。' },
] as const satisfies readonly ProjectDef[];

export type ProjectId = (typeof PROJECTS)[number]['id'];
export const PROJECT_MAP: Record<string, ProjectDef> = Object.fromEntries(PROJECTS.map((p) => [p.id, p]));

export function isProjectId(id: string): id is ProjectId {
  return id in PROJECT_MAP;
}

export function projectsOf(business: BusinessKindId): ProjectDef[] {
  return (PROJECTS as readonly ProjectDef[]).filter((p) => p.business === business);
}
