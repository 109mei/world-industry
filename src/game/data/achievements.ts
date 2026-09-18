import type { DerivedState, GameState } from '@/types/state';
import { RESEARCH } from './research';

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  check: (state: GameState, derived: DerivedState) => boolean;
}

const sum = (rec: Record<string, number | undefined>) => Object.values(rec).reduce<number>((a, b) => a + (b ?? 0), 0);

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_stone', name: '最初の石', description: '初めて石を拾う。', icon: 'icon_resource_stone', check: (s) => (s.stats.totalGathered['stone'] ?? 0) >= 1 },
  { id: 'toolsmith', name: '工具職人', description: '道具を100個作る。', icon: 'icon_tool_hammer_stone', check: (s) => sum(s.stats.toolsCrafted) >= 100 },
  { id: 'first_hire', name: '初めての雇用', description: '作業員を雇う。', icon: 'icon_facility_worker', check: (s) => s.facilities.some((f) => f.count > 0) },
  { id: 'industrial_revolution', name: '産業革命', description: '最初の工場（スクラップ溶解炉）を建設する。', icon: 'icon_facility_steel_mill', check: (s) => s.facilities.some((f) => f.typeId === 'simple_smelter' && f.count > 0) },
  { id: 'iron_age', name: '鉄の時代', description: '鉄を100kg入手する。', icon: 'icon_material_iron', check: (s) => (s.stats.totalObtained['iron'] ?? 0) >= 100 },
  { id: 'merchant', name: '商人', description: '累計10,000円を売り上げる。', icon: 'icon_ui_sell', check: (s) => s.company.totalEarned >= 10_000 },
  { id: 'millionaire', name: '百万長者', description: '1,000,000円を所持する。', icon: 'icon_ui_money', check: (s) => s.company.cash >= 1_000_000 },
  { id: 'billionaire', name: '億万長者', description: '100,000,000円を所持する。', icon: 'icon_ui_crown', check: (s) => s.company.cash >= 100_000_000 },
  { id: 'landowner', name: '土地所有者', description: '初めて土地を購入する。', icon: 'icon_ui_land', check: (s) => s.lands.some((l) => l.id !== 'hq') },
  { id: 'prospector', name: '山師', description: '試掘まで終えた土地を持つ。', icon: 'icon_marker_survey', check: (s) => s.lands.some((l) => l.id !== 'hq' && l.survey >= 3) },
  { id: 'first_scientist', name: '初めての研究', description: '研究を1つ完了する。', icon: 'icon_ui_research', check: (s) => Object.keys(s.research.completed).length >= 1 },
  { id: 'electrified', name: '電化', description: '初めて発電する。', icon: 'icon_ui_power', check: (s) => s.stats.totalGeneratedMWh > 0 },
  { id: 'power_king', name: '発電王', description: '発電能力が1GW（1,000MW）に達する。', icon: 'icon_power_transmission_tower', check: (_s, d) => d.power.capacity >= 1000 },
  { id: 'freight', name: '大量輸送', description: '累計10,000tを輸送する。', icon: 'icon_logistics_containers', check: (s) => s.stats.totalTransported >= 10_000 },
  { id: 'world_company', name: '世界企業', description: '5ヵ国に土地を所有する。', icon: 'icon_ui_company', check: (s) => new Set(s.lands.map((l) => l.country)).size >= 5 },
  { id: 'atomic_age', name: '原子力時代', description: '原子力発電所を建設する。', icon: 'icon_power_nuclear', check: (s) => s.facilities.some((f) => f.typeId === 'nuclear_plant' && f.count > 0) },
  { id: 'aviator', name: '空の物流', description: '貨物機を配備する。', icon: 'icon_logistics_airplane', check: (s) => s.facilities.some((f) => f.typeId === 'cargo_plane' && f.count > 0) },
  { id: 'automaker', name: '自動車メーカー', description: '自動車を累計100台生産する。', icon: 'icon_facility_vehicle_factory', check: (s) => (s.stats.totalProduced['car'] ?? 0) >= 100 },
  { id: 'chipmaker', name: '半導体の覇者', description: '半導体を累計1,000個生産する。', icon: 'icon_material_semiconductor', check: (s) => (s.stats.totalProduced['semiconductor'] ?? 0) >= 1000 },
  { id: 'robot_age', name: 'ロボットの時代', description: '産業ロボットを累計10台生産する。', icon: 'icon_part_robot_arm', check: (s) => (s.stats.totalProduced['robot'] ?? 0) >= 10 },
  { id: 'survivor', name: '災害を乗り越えて', description: '災害（地震・嵐・猛暑）を5回経験する。', icon: 'icon_weather_storm', check: (s) => s.stats.disasters >= 5 },
  { id: 'tycoon', name: '大財閥', description: '累計売上が10億円に達する。', icon: 'icon_ui_medal', check: (s) => s.company.totalEarned >= 1_000_000_000 },
  // ---- 不動産・株式 ----
  { id: 'first_property', name: '初めての不動産', description: '実在の場所の土地や物件を初めて買う。', icon: 'icon_terrain_residential', check: (s) => s.stats.propertiesBought >= 1 },
  { id: 'landlord', name: '大家さん', description: '物件を10件所有する。', icon: 'icon_commercial_apartment', check: (s) => Object.keys(s.estate?.owned ?? {}).length >= 10 },
  { id: 'ginza', name: '銀座のビルオーナー', description: '銀座4丁目の商業ビルを所有する。', icon: 'icon_commercial_mall', check: (s) => s.estate?.owned?.['tk_ginza_bldg'] !== undefined },
  { id: 'global_landlord', name: '世界の地主', description: '5ヵ国以上に物件を持つ。', icon: 'icon_ui_location', check: (_s, d) => d.estateCountries >= 5 },
  { id: 'shareholder', name: '株主', description: '初めて株を買う。', icon: 'icon_ui_chart', check: (s) => Object.values(s.stocks?.companies ?? {}).some((c) => c.playerShares > 0) },
  { id: 'controller', name: '経営権', description: '会社の株を3分の2以上持つ。', icon: 'icon_office_contract', check: (_s, d) => Object.values(d.companies).some((c) => c.ownership + 1e-9 >= 2 / 3) },
  { id: 'acquirer', name: '買収王', description: '会社を完全買収する。', icon: 'icon_ui_crown', check: (s) => s.stats.companiesAcquired >= 1 },
  { id: 'trillionaire', name: '兆万長者', description: '総資産が1兆円に達する。', icon: 'icon_ui_trophy', check: (_s, d) => d.assets >= 1_000_000_000_000 },
  // ---- v1.0 追加 ----
  { id: 'real_place', name: '実在の場所を買う', description: '地図から実在の建物や区画を買う。', icon: 'icon_ui_location', check: (s) => Object.keys(s.estate?.custom ?? {}).length >= 1 },
  { id: 'place_collector', name: '街を買い集める', description: '地図から買った場所が10ヵ所になる。', icon: 'icon_terrain_city', check: (s) => Object.keys(s.estate?.custom ?? {}).length >= 10 },
  { id: 'osm_prospector', name: '街の山師', description: '地図で買った土地を試掘まで調べる。', icon: 'icon_machine_drilling_rig', check: (s) => s.lands.some((l) => l.id.startsWith('osm:') && l.survey >= 3) },
  { id: 'hq_move', name: '本社移転', description: '本社の場所を自分で決める。', icon: 'icon_ui_company', check: (s) => !!s.settings?.hqLocation },
  { id: 'first_deal', name: '初めての契約', description: '営業して契約を結ぶ。', icon: 'icon_office_contract', check: (s) => (s.sales?.deals.length ?? 0) >= 1 || s.stats.contractsCompleted >= 1 },
  { id: 'reliable_supplier', name: '頼れる取引先', description: '契約を10件やりきる。', icon: 'icon_ui_medal', check: (s) => s.stats.contractsCompleted >= 10 },
  { id: 'partner', name: '専属パートナー', description: 'どこかの会社との関係を90まで深める。', icon: 'icon_ui_crown', check: (s) => Object.values(s.sales?.clients ?? {}).some((c) => c.relation >= 90) },
  { id: 'many_clients', name: '取引先を広げる', description: '5社と取引の関係を持つ（関係20以上）。', icon: 'icon_ui_chart', check: (s) => Object.values(s.sales?.clients ?? {}).filter((c) => c.relation >= 20).length >= 5 },
  { id: 'sap_tapper', name: '樹液採り', description: '樹液を100kg集める。', icon: 'icon_chemical_resin', check: (s) => (s.stats.totalObtained['sap'] ?? 0) >= 100 },
  { id: 'woodworker', name: '木工職人', description: '家具を10個作る。', icon: 'icon_office_chair', check: (s) => (s.stats.totalProduced['furniture'] ?? 0) >= 10 },
  { id: 'chemist', name: '化学者', description: '化学薬品を1,000L作る。', icon: 'icon_material_chemical', check: (s) => (s.stats.totalProduced['chemical'] ?? 0) >= 1000 },
  { id: 'battery_maker', name: '電池工場', description: 'バッテリーを100個作る。', icon: 'icon_material_battery', check: (s) => (s.stats.totalProduced['battery'] ?? 0) >= 100 },
  { id: 'feed_the_city', name: '食を支える', description: '加工食品を1,000個作る。', icon: 'icon_food_bread', check: (s) => (s.stats.totalProduced['food'] ?? 0) >= 1000 },
  { id: 'material_master', name: '素材マスター', description: '20種類以上の資源を手に入れる。', icon: 'icon_tool_toolbox', check: (s) => Object.keys(s.stats.totalObtained).length >= 20 },
  { id: 'kingmaker', name: '常連をつかむ', description: 'ひとつの取引先に20回納品する。', icon: 'icon_ui_chart', check: (s) => Object.values(s.sales?.clients ?? {}).some((c) => c.deliveries >= 20) },
  // ---- v1.2: 事業・お店・研究・賭け事・番付 ----
  { id: 'first_business', name: '自分の看板', description: '自分の事業を1つ始める。', icon: 'icon_commercial_shop', check: (s) => (s.business?.divisions.length ?? 0) >= 1 },
  { id: 'shopkeeper', name: '店主', description: 'お店で1,000点を売る。', icon: 'icon_commercial_supermarket', check: (s) => (s.business?.divisions ?? []).reduce((a, d) => a + (d.sold ?? 0), 0) >= 1000 },
  { id: 'chain_owner', name: 'チェーン店', description: '同じ業種のお店を5店もつ。', icon: 'icon_commercial_mall', check: (s) => {
    const c: Record<string, number> = {};
    for (const d of s.business?.divisions ?? []) c[d.kind] = (c[d.kind] ?? 0) + 1;
    return Object.values(c).some((n) => n >= 5);
  } },
  { id: 'conglomerate', name: 'コングロマリット', description: '10種類の業種を同時に営む。', icon: 'icon_ui_company', check: (s) => new Set((s.business?.divisions ?? []).map((d) => d.kind)).size >= 10 },
  { id: 'household_name', name: '誰もが知る名前', description: 'どこかの事業の知名度を90にする。', icon: 'icon_ui_star', check: (s) => (s.business?.divisions ?? []).some((d) => d.awareness >= 90) },
  { id: 'luxury_brand', name: '憧れのブランド', description: 'どこかの事業のブランド価値を70にする。', icon: 'icon_ui_medal', check: (s) => (s.business?.divisions ?? []).some((d) => d.brand >= 70) },
  { id: 'big_employer', name: '大きな雇い主', description: '従業員が1,000人になる。', icon: 'icon_facility_worker', check: (_s, d) => d.employees >= 1000 },
  { id: 'ad_man', name: '広告を打つ', description: '初めて広告を契約する。', icon: 'icon_ui_chart_trend', check: (s) => (s.business?.divisions ?? []).some((d) => d.ads.length > 0) },
  { id: 'billboard_owner', name: '街に看板', description: '屋外看板を立てる。', icon: 'icon_ui_location', check: (s) => (s.business?.divisions ?? []).some((d) => d.ads.some((a) => a.adId === 'billboard')) },
  { id: 'tv_star', name: 'お茶の間へ', description: 'テレビCMを打つ。', icon: 'icon_ui_star', check: (s) => (s.business?.divisions ?? []).some((d) => d.ads.some((a) => a.adId === 'tv')) },
  { id: 'parking_lot', name: '駐車場を確保', description: '土地を駐車場としてお店に付ける。', icon: 'icon_commercial_parking', check: (s) => (s.business?.divisions ?? []).some((d) => d.parkingLands.length > 0) },
  { id: 'first_project', name: '初仕事', description: '案件を1件やりとげる。', icon: 'icon_office_documents', check: (s) => (s.business?.divisions ?? []).some((d) => d.completed >= 1) },
  { id: 'hit_product', name: 'ヒット作', description: '製品の利用者が10万人になる。', icon: 'icon_ui_chart_trend', check: (s) => (s.business?.divisions ?? []).some((d) => d.products.some((p) => p.users >= 100_000)) },
  { id: 'product_line', name: '製品ラインナップ', description: '発売した製品を5つ同時にかかえる。', icon: 'icon_material_semiconductor', check: (s) => (s.business?.divisions ?? []).some((d) => d.products.length >= 5) },
  { id: 'project_veteran', name: '百戦錬磨', description: '案件を通算100件やりとげる。', icon: 'icon_ui_trophy', check: (s) => (s.business?.divisions ?? []).reduce((a, d) => a + d.completed, 0) >= 100 },
  // 掘る
  { id: 'gold_finder', name: '金を掘り当てる', description: '金鉱石を初めて手に入れる。', icon: 'icon_office_coins', check: (s) => (s.stats.totalObtained['gold_ore'] ?? 0) >= 1 },
  { id: 'gold_rush', name: 'ゴールドラッシュ', description: '鉱区で大鉱脈を掘り当てる。', icon: 'icon_machine_drilling_rig', check: (s) => (s.business?.divisions ?? []).some((d) => (d.rush ?? 0) > 0 || (d.dug ?? 0) >= 50_000) },
  // 宝石は施設では作れず、クラフト（原石を磨く）だけで手に入る。
  // クラフトは totalProduced に積まれないので、作った回数で判定する
  { id: 'gem_cutter', name: '宝石職人', description: '宝石を10個磨き上げる。', icon: 'icon_resource_gem', check: (s) => (s.stats.crafted?.['cut_gem'] ?? 0) >= 10 },
  { id: 'bullion', name: '金庫の中身', description: '金を1,000g（1kg）ためる。', icon: 'icon_office_coins', check: (s) => (s.inventory['gold'] ?? 0) >= 1000 },
  { id: 'oil_strike', name: '油田を当てる', description: '原油を10,000L手に入れる。', icon: 'icon_resource_crude_oil', check: (s) => (s.stats.totalObtained['crude_oil'] ?? 0) >= 10_000 },
  // 賭け事
  { id: 'first_bet', name: '初めての賭け', description: '一度でも賭けてみる。', icon: 'icon_ui_star', check: (s) => (s.stats.gambleBet ?? 0) > 0 },
  { id: 'jackpot', name: 'ジャックポット', description: '賭けで一度に1,000万円以上を当てる。', icon: 'icon_ui_crown', check: (s) => (s.stats.gambleWon ?? 0) >= 10_000_000 },
  { id: 'lottery_winner', name: '宝くじ当選', description: '宝くじを当てる。', icon: 'icon_ui_trophy', check: (s) => (s.lottery?.won ?? 0) >= 1 },
  { id: 'house_wins', name: '胴元は強い', description: '賭けで通算1億円を失う。', icon: 'icon_ui_loss', check: (s) => (s.stats.gambleBet ?? 0) - (s.stats.gambleWon ?? 0) >= 100_000_000 },
  { id: 'casino_owner', name: 'カジノのオーナー', description: 'カジノを開く。', icon: 'icon_ui_star', check: (s) => (s.business?.divisions ?? []).some((d) => d.kind === 'casino') },
  // 研究
  { id: 'researcher_10', name: '研究者', description: '研究を10件終える。', icon: 'icon_ui_research', check: (s) => Object.keys(s.research.completed).length >= 10 },
  { id: 'researcher_40', name: '技術の会社', description: '研究を40件終える。', icon: 'icon_commercial_rnd_center', check: (s) => Object.keys(s.research.completed).length >= 40 },
  // 件数を直書きすると研究を足したときにずれるので、データから全部そろったかを見る
  { id: 'researcher_all', name: '研究を極める', description: '研究をすべて終える。', icon: 'icon_ui_trophy', check: (s) => RESEARCH.every((r) => s.research.completed[r.id] === true) },
  { id: 'ai_age', name: '人工知能の時代', description: '「人工知能」を研究する。', icon: 'icon_part_robot_arm', check: (s) => s.research.completed['ai'] === true },
  { id: 'fusion_age', name: '核融合', description: '「核融合」を研究する。', icon: 'icon_power_nuclear', check: (s) => s.research.completed['fusion'] === true },
  // 手仕事の腕
  { id: 'apprentice', name: '見習いを抜ける', description: '手仕事の腕のどれかを Lv.5 にする。', icon: 'icon_game_sorting', check: (s) => Object.values(s.skills ?? {}).some((v) => (v?.level ?? 0) >= 5) },
  { id: 'master_hands', name: '腕利き', description: '4つの腕を合わせて Lv.40 にする。', icon: 'icon_ui_medal', check: (s) => Object.values(s.skills ?? {}).reduce((a, v) => a + (v?.level ?? 0), 0) >= 40 },
  // お金と番付
  { id: 'listed', name: '番付に載る', description: '長者番付に名前が載る。', icon: 'icon_ui_medal', check: (_s, d) => d.assets >= 42_000_000 },
  { id: 'top100', name: '番付の常連', description: '長者番付で30位以内に入る。', icon: 'icon_ui_crown', check: (_s, d) => d.assets >= 1_600_000_000_000 },
  { id: 'top10', name: '世界の10人', description: '長者番付で10位以内に入る。', icon: 'icon_ui_trophy', check: (_s, d) => d.assets >= 19_000_000_000_000 },
  { id: 'richest', name: '世界一', description: '長者番付で1位になる。', icon: 'icon_ui_crown', check: (_s, d) => d.assets >= 62_000_000_000_000 },
  // 苦労
  { id: 'in_the_red', name: '火の車', description: '資金がマイナスになる。', icon: 'icon_ui_warning', check: (s) => (s.company.debtSeconds ?? 0) > 0 },
  { id: 'bankrupt', name: 'それでも立ち上がる', description: '一度倒産して、また始める。', icon: 'icon_ui_warning', check: (s) => (s.stats.bankruptcies ?? 0) >= 1 },
  { id: 'phoenix', name: '不死鳥', description: '倒産から立ち直って総資産10億円に戻す。', icon: 'icon_ui_trophy', check: (s, d) => (s.stats.bankruptcies ?? 0) >= 1 && d.assets >= 1_000_000_000 },
  { id: 'wage_payer', name: '給料を払い続ける', description: '人件費を通算1億円払う。', icon: 'icon_facility_worker', check: (s) => (s.stats.totalWages ?? 0) >= 100_000_000 },
  { id: 'storm_rider', name: '嵐のなかで', description: '災害を50回くぐり抜ける。', icon: 'icon_weather_storm', check: (s) => s.stats.disasters >= 50 },
  { id: 'event_veteran', name: '何が起きても', description: 'ランダムイベントを200回経験する。', icon: 'icon_ui_time', check: (s) => s.stats.eventsOccurred >= 200 },
  // 永続
  { id: 'reborn', name: '再出発', description: '初めて会社を売って再出発する。', icon: 'icon_ui_medal', check: (s) => (s.prestige?.count ?? 0) >= 1 },
  { id: 'reborn_10', name: '何度でも', description: '10回 再出発する。', icon: 'icon_ui_crown', check: (s) => (s.prestige?.count ?? 0) >= 10 },
  { id: 'automated', name: 'すべて自動で', description: '自動化を6種類そろえる。', icon: 'icon_part_robot_arm', check: (s) => ['auto_gather', 'auto_craft', 'auto_deliver', 'auto_pitch', 'auto_survey', 'auto_build'].filter((k) => (s.prestige?.upgrades?.[k] ?? 0) > 0).length >= 6 },
  { id: 'bulk_buyer', name: '買い占め', description: '一括買収で物件をまとめて買う。', icon: 'icon_ui_location', check: (s) => (s.prestige?.upgrades?.bulk_buy ?? 0) > 0 && Object.keys(s.estate?.custom ?? {}).length >= 20 },
];
