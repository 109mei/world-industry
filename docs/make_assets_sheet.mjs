/*
 * 必要な素材を1枚にまとめたシートを作る。
 *
 * 3つに分けて出す。
 *  1. いま足りないもの     … コードが名前を使っているのに画像が無いもの（機械的に検出）
 *  2. これから必要になるもの … v2 で作る機能のために、あらかじめ要るもの（手で書いた一覧）
 *  3. あった方が良いもの     … 無くても動くが、あると見栄え・手触りが上がるもの
 * おまけに「いま持っているが使っていない絵」も並べる。新しく描く前にここを見れば、
 * 描かずに済むものが分かる。
 *
 * 使い方: node docs/make_assets_sheet.mjs [出力先.html]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');
const SRC = path.join(APP, 'src');
const ICONS = path.join(APP, 'public/assets/icons');
const OUT = process.argv[2] || path.join(HERE, 'assets-needed.html');

const have = new Set(
  fs.readdirSync(ICONS).filter((f) => f.endsWith('.png')).map((f) => f.replace(/\.png$/, '')),
);

// コードの中の 'icon_xxx' をすべて集める
const used = new Map();
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      walk(p);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(e.name)) continue;
    const s = fs.readFileSync(p, 'utf8');
    for (const m of s.matchAll(/['"`](icon_[a-z0-9_]+)['"`]/g)) {
      if (!used.has(m[1])) used.set(m[1], new Set());
      used.get(m[1]).add(path.relative(SRC, p));
    }
  }
})(SRC);

const missing = [...used.keys()].filter((n) => !have.has(n)).sort();
const unused = [...have].filter((n) => !used.has(n)).sort();

/** 足りないものの説明（無ければ「用途未整理」と出る） */
const BRIEF = {};

/**
 * これから必要になるもの。
 * [ファイル名, 何の絵か, どう描くか, どの機能で使うか, 代わりに使える手持ち, 優先度]
 * 優先度は「要」＝いまの手持ちでは意味が通らないので描いてほしいもの、
 *          「欲しい」＝近い絵が手持ちにあるので当面は困らないもの。
 */
const PLANNED = [
  // ---- 交通事業 ----
  ['icon_transit_bus', 'バス（車両）', '路線バス1台を斜め前から。角ばった箱型で窓が並び、前面に行き先の表示。地図の上で小さく出るので、輪郭とシルエットを強く。', '交通事業', 'icon_logistics_truck', '要'],
  ['icon_transit_taxi', 'タクシー', 'セダン1台を斜め前から。屋根に行灯（あんどん）。車体は黄色系にして自家用車と区別。', '交通事業', 'icon_logistics_truck', '要'],
  ['icon_transit_train', '旅客列車', '通勤電車の先頭車両を斜め前から。窓が並び、前面に行き先表示。貨物列車（icon_logistics_train）と一目で違うように。', '交通事業', 'icon_logistics_train', '欲しい'],
  ['icon_transit_airliner', '旅客機', '旅客機を斜め前から。客室の窓が並ぶ。貨物機（icon_logistics_airplane）と区別できるよう窓と尾翼の色を強調。', '航空事業', 'icon_logistics_airplane', '欲しい'],
  ['icon_transit_bus_stop', 'バス停', '標識のポール1本と小さな時刻表。屋根付きの待合ベンチがあってもよい。', '交通事業', 'icon_ui_location', '要'],
  ['icon_transit_platform', '駅のホーム', '屋根とベンチのあるプラットホーム。線路が手前を横切る。', '鉄道事業', 'icon_commercial_train_station', '要'],
  ['icon_transit_airport', '空港ターミナル', '管制塔と横長のターミナル。手前に滑走路の白線。', '航空事業', 'icon_logistics_airport_cargo', '要'],
  ['icon_transit_passenger', '乗客', '人が3人ほど並んだシルエット。人数や混雑を表すのに使う。顔は描かない。', '交通事業', 'icon_facility_worker', '要'],
  ['icon_transit_ticket', '切符・運賃', '切符1枚。斜めに置き、端に切り込み。金額は描かない（数字は画面で出す）。', '交通事業', 'icon_ui_money', '要'],
  ['icon_transit_route', '路線図', '3つの駅を線でつないだ路線図。丸と線だけの簡単なもの。', '交通事業', 'icon_ui_logistics', '要'],
  ['icon_transit_depot', '車庫・営業所', 'バスか列車が数台入った車庫。シャッターの開いた建物。', '交通事業', 'icon_logistics_rail_depot', '欲しい'],

  // ---- 農業 ----
  ['icon_farm_field', '畑の区画', '畝（うね）の並んだ四角い畑を斜め上から。作物はまだ小さい。', '農業', 'icon_terrain_farmland', '要'],
  ['icon_farm_sprout', '芽・苗', '土から出たばかりの双葉。育てるミニゲームの途中にも使う。', '農業・ミニゲーム', 'icon_food_seeds', '欲しい'],
  ['icon_farm_harvest', '収穫かご', '野菜が山盛りになったかご。何が入っているかは特定しない。', '農業', 'icon_food_potato', '要'],
  ['icon_farm_watering', 'じょうろ', '水の出ているじょうろ。育てるミニゲームで使う。', '農業・ミニゲーム', 'icon_resource_water', '要'],
  ['icon_farm_sap', '樹液採取', '木の幹に取り付けた樹液の受け筒。', '農業', 'icon_chemical_resin', '欲しい'],

  // ---- ミニゲーム ----
  ['icon_game_sorting', '仕分けのベルト', 'ベルトコンベアの上に、金属・紙・プラスチックが混ざって流れている。', 'ミニゲーム', 'icon_logistics_conveyor', '要'],
  ['icon_game_break', '岩を割る', 'ひびの入った岩とつるはし。ひびが「弱点」に見えるように。', 'ミニゲーム', 'icon_machine_jackhammer', '要'],
  ['icon_game_fishing', '釣り', '釣り竿と浮き。水面の輪。', 'ミニゲーム', 'icon_food_fish', '要'],
  ['icon_game_timing', 'タイミングの的', '中心に印のある的と、動く針。押す瞬間を表す。', 'ミニゲーム', 'icon_ui_star', '要'],

  // ---- 経営（決算・税・借入・従業員） ----
  ['icon_office_ledger', '決算書', '表とグラフの載った書類。判子の押された表紙でもよい。', '決算', 'icon_office_checklist', '要'],
  ['icon_office_tax', '納税', '封筒に入った納付書。パーセント記号があると分かりやすい。', '税金', 'icon_office_stamp', '要'],
  ['icon_office_loan', '借入', '銀行と矢印。お金が会社へ流れる向き。', '借入', 'icon_commercial_bank', '要'],
  ['icon_office_hire', '採用', '履歴書と人のシルエット。', '従業員', 'icon_office_id_badge', '欲しい'],
  ['icon_office_quit', '離職', 'ドアから出ていく人のシルエット。暗い色でよい。', '従業員', 'icon_office_id_badge', '欲しい'],
  ['icon_office_skill', '熟練度', '星3つと工具。人が育ったことを表す。', '従業員', 'icon_office_training_book', '欲しい'],

  // ---- 会社・拠点 ----
  ['icon_company_hq_move', '本社の移転', '建物と矢印。引っ越しを表す。', '本社の移転', 'icon_ui_location', '要'],
  ['icon_company_branch', '支店', '本社より小ぶりな建物。看板に社名の入る余白。', '支店', 'icon_commercial_office', '欲しい'],
  ['icon_company_rival', '競合他社', '向かい合う2つの建物。片方は色を変える。', '競合', 'icon_ui_company', '欲しい'],

  // ---- 地図に置く車両（真上から見た絵。上が進行方向） ----
  ['icon_transit_bus_top', 'バス（真上から）', '地図の上を進むときの絵。上が進行方向。', '交通事業', 'icon_transit_bus', '要'],
  ['icon_transit_taxi_top', 'タクシー（真上から）', '地図の上を進むときの絵。上が進行方向。', '交通事業', 'icon_transit_taxi', '要'],
  ['icon_transit_truck_top', 'トラック（真上から）', '地図の上を進むときの絵。上が進行方向。', '物流', 'icon_logistics_truck', '要'],
  ['icon_transit_train_top', '列車（真上から）', '地図の上を進むときの絵。上が進行方向。', '鉄道事業', 'icon_transit_train', '要'],
  ['icon_transit_timetable', '発車案内・時刻表', '駅やバス停の電光掲示板。行き先と時刻が並ぶ。', '交通事業', 'icon_office_calendar', '欲しい'],

  // ---- v1.6 で足した素材・施設（いまは近い絵を借りている） ----
  ['icon_material_aluminum_ingot', 'アルミの地金', '銀色の地金を数本積んだもの。銀（icon_material_aluminum）と見分けがつくよう、角ばった押し出し材の形にする。', '素材', 'icon_material_composite_panel', '要'],
  ['icon_material_silver', '銀', '銀の延べ棒。金（icon_office_coins）と並べても色で区別できるように。いまは銀がアルミの絵を使っている。', '素材', 'icon_material_aluminum', '欲しい'],
  ['icon_product_jewelry', '宝飾品', '指輪かネックレス1点。宝石（icon_resource_gem）と違い、金具に仕立ててあることが分かる形に。', '製品', 'icon_resource_gem', '要'],
  ['icon_product_leather_goods', '革製品', '革の鞄1つ。素材の革（icon_material_leather）と一目で違うように。', '製品', 'icon_material_leather', '要'],
  ['icon_facility_jewelry_workshop', '宝飾工房', '作業台とルーペ、小さな万力。宝石が1粒。', '施設', 'icon_resource_gem', '欲しい'],
  ['icon_facility_leather_workshop', '革製品工場', 'ミシンと革の巻物がある工房。いまは製品（鞄）の絵を借りている。', '施設', 'icon_product_leather_goods', '欲しい'],
  ['icon_facility_ceramic_kiln', '窯業工場', 'れんが造りの窯と、焼き上がった皿や壺。レンガ工場（icon_facility_brick_factory）と区別できるように。', '施設', 'icon_facility_brick_factory', '欲しい'],
  ['icon_facility_printing_plant', '印刷工場', '輪転機から紙が流れ出ている。', '施設', 'icon_office_notebook', '欲しい'],
  ['icon_facility_bearing_factory', '軸受工場', 'ベアリングが並ぶ生産ライン。部品そのもの（icon_part_bearing）とは別に、建物として。', '施設', 'icon_part_bearing', '欲しい'],
  ['icon_facility_motor_factory', '電動機工場', 'モーターを組み立てるライン。', '施設', 'icon_part_electric_motor', '欲しい'],
  ['icon_facility_ammonia_plant', 'アンモニア工場', '圧力タンクと配管の並ぶ化学プラント。', '施設', 'icon_chemical_ammonia', '欲しい'],
  ['icon_facility_sulfur_mine', '硫黄鉱山', '黄色い硫黄が積まれた山肌の採掘場。', '施設', 'icon_chemical_sulfur_bag', '欲しい'],

  // ---- 時間・成績 ----
  ['icon_ui_clock_speed', '早送り', '時計と二重の三角（早送り記号）。', 'ゲーム内カレンダー', 'icon_ui_fast_forward', '欲しい'],
  ['icon_ui_report_card', '成績', '賞状のような1枚。数字の並ぶ余白。', 'ゲームオーバーの成績', 'icon_office_certificate', '要'],
  ['icon_ui_rebirth', '転生', '輪になった矢印と小さな芽。やり直しを表す。', '転生ボーナス', 'icon_ui_upgrade', '要'],
];

/**
 * アイコン以外のもの。
 * 「もう置いてあるか」をファイルの有無で自分で数えるので、
 * 届いたのに一覧に残り続ける、ということが起きない。
 */
const PUBLIC = path.join(APP, 'public');

function countFiles(dir, test) {
  const full = path.join(PUBLIC, dir);
  if (!fs.existsSync(full)) return 0;
  return fs.readdirSync(full).filter((f) => test.test(f)).length;
}

const OTHERS = [
  {
    name: 'カードのイラスト（モンスター100種）', spec: 'WEBP / 各 512×512',
    desc: 'カード専用の絵。集めたくなるかどうかがここで決まる。',
    have: () => countFiles('assets/cards', /^mc_\d+\.webp$/), need: 100, tag: 'あると良い',
  },
  {
    name: 'トランプの絵札（J・Q・K）', spec: 'PNG / 各 240×340',
    desc: 'バカラで使う絵札。A〜10は文字のままでよい。',
    have: () => countFiles('assets/cards', /^face_[JQK]_[cdhs]\.png$/), need: 12, tag: 'あると良い',
  },
  {
    name: 'パチンコ台の盤面', spec: 'PNG / 600×840 目安',
    desc: '木枠・ランプ・役物の描かれた背景板。',
    have: () => countFiles('assets/art', /^pachinko_board\.(png|jpg)$/), need: 1, tag: 'あると良い',
  },
  {
    name: 'スロット台の枠', spec: 'PNG / 900×600 目安',
    desc: '3つのリール窓を囲む枠。',
    have: () => countFiles('assets/art', /^slot_machine\.(png|jpg)$/), need: 1, tag: 'あると良い',
  },
  {
    name: 'ルーレット盤', spec: 'PNG / 400×400・620×604',
    desc: '中心の金属ハブと、数字の並んだ盤面。',
    have: () => countFiles('assets/art', /^roulette_(hub|wheel)\.(png|jpg)$/), need: 2, tag: 'あると良い',
  },
  {
    name: '地図に置く車両の絵（上から見た図）', spec: 'PNG / 各 128×128',
    desc: 'バス・タクシー・トラック・列車を真上から。上が進行方向。',
    have: () => countFiles('assets/icons', /^icon_transit_(bus|taxi|truck|train)_top\.png$/), need: 4, tag: 'あると良い',
  },
  {
    name: '季節の背景（4枚）', spec: 'JPEG / 1600×533',
    desc: '春・夏・秋・冬。ホームの帯に出る。',
    have: () => countFiles('assets/art', /^season_(spring|summer|autumn|winter)\.(jpg|png)$/), need: 4, tag: 'あると良い',
  },
  {
    name: 'アプリのアイコン', spec: 'PNG / 180・192・512・512(maskable)',
    desc: 'ホーム画面に追加したときの見た目。',
    have: () => countFiles('icons', /^icon-(180|192|512|512-maskable)\.png$/), need: 4, tag: 'あると良い',
  },
  {
    name: '共有用の画像（OGP）', spec: 'JPEG / 1200×630',
    desc: 'URLを共有したときに出るサムネイル。',
    have: () => (fs.existsSync(path.join(PUBLIC, 'og.jpg')) ? 1 : 0), need: 1, tag: 'あると良い',
  },
  {
    name: 'BGM', spec: 'OGG（＋m4a）/ 1〜2分のループ',
    desc: 'いまはカジノの曲だけ。通常の画面と、工場・地図の画面ぶんがあると場面が立つ。',
    have: () => countFiles('assets/bgm', /\.ogg$/), need: 3, tag: '任意',
  },
  {
    name: '効果音', spec: '不要',
    desc: '効果音はファイルを使わず、その場で音を合成している（Web Audio）。差し替えたい場合のみ WAV/OGG が要る。',
    have: () => 1, need: 1, tag: '不要',
  },
];

const dataUri = (name) => {
  const p = path.join(ICONS, name + '.png');
  if (!fs.existsSync(p)) return '';
  return 'data:image/png;base64,' + fs.readFileSync(p).toString('base64');
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const missingRows = missing
  .map((name) => {
    const b = BRIEF[name] || ['（用途未整理）', '', ''];
    const where = [...(used.get(name) || [])].slice(0, 3).join(' / ');
    return `<tr>
      <td class="shot"><span class="none">なし</span></td>
      <td>
        <div class="fname">${esc(name)}.png</div>
        <div class="title">${esc(b[0])}</div>
        <div class="desc">${esc(b[1])}</div>
        <div class="where">使う場所: ${esc(where)}</div>
      </td>
      <td class="tag"><span class="chip chip--need">要</span></td>
    </tr>`;
  })
  .join('\n');

const plannedRows = PLANNED.map(([name, title, desc, group, fb, pri]) => {
  const done = have.has(name); // もう届いている絵
  const fbOk = !done && fb && have.has(fb);
  const shown = done ? name : fbOk ? fb : null;
  const need = !done && pri === '要';
  return `<tr>
    <td class="shot">${shown ? `<img src="${dataUri(shown)}" alt="${done ? 'この絵' : '代わりに使える絵'}">` : '<span class="none">なし</span>'}</td>
    <td>
      <div class="fname">${esc(name)}.png</div>
      <div class="title">${esc(title)}</div>
      <div class="desc">${esc(desc)}</div>
      ${done ? '<div class="where">届いています（左の絵）</div>' : fbOk ? `<div class="where">当面の代わり: ${esc(fb)}.png（左の絵）</div>` : '<div class="where">代わりになる絵は手持ちにありません</div>'}
    </td>
    <td class="tag"><span class="chip chip--${done ? 'done' : need ? 'need' : 'opt'}">${done ? '済' : esc(pri)}</span><div class="group">${esc(group)}</div></td>
  </tr>`;
}).join('\n');

const otherRows = OTHERS.map((o) => {
  const have = o.have();
  const done = have >= o.need;
  const chip = o.tag === '不要' ? 'no' : done ? 'done' : 'opt';
  const label = o.tag === '不要' ? '不要' : done ? '済' : o.tag;
  return `<tr>
    <td class="shot"><span class="none">${done ? '済' : '—'}</span></td>
    <td>
      <div class="title">${esc(o.name)}</div>
      <div class="desc">${esc(o.desc)}</div>
      <div class="where">形式: ${esc(o.spec)}／いま ${have} / ${o.need} 点</div>
    </td>
    <td class="tag"><span class="chip chip--${chip}">${esc(label)}</span></td>
  </tr>`;
}).join('\n');

const spareCells = unused
  .map((n) => `<figure class="spare"><img src="${dataUri(n)}" alt="${esc(n)}" loading="lazy"><figcaption>${esc(n.replace(/^icon_/, ''))}</figcaption></figure>`)
  .join('\n');

const doneCount = PLANNED.filter(([name]) => have.has(name)).length;
const needCount = missing.length + PLANNED.filter(([name, , , , , pri]) => !have.has(name) && pri === '要').length;
const wantCount = PLANNED.filter(([name, , , , , pri]) => !have.has(name) && pri !== '要').length + OTHERS.filter((o) => o.tag === 'あると良い' && o.have() < o.need).length;

const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>WORLD INDUSTRY 素材リスト</title>
<style>
  :root {
    --bg: #0E1116; --card: #171C24; --card2: #1E242E; --line: #2A323E; --line2: #3A4554;
    --text: #E8EDF4; --sub: #A9B4C4; --dim: #6B7684;
    --need: #C0392B; --opt: #C08A00; --no: #6B7684; --accent: #0072B2; --ok: #1E8E5A;
  }
  @media (prefers-color-scheme: light) {
    :root:not([data-theme="dark"]) {
      --bg: #F5F7FA; --card: #FFFFFF; --card2: #EEF2F7; --line: #D8DFE8; --line2: #B9C4D2;
      --text: #10161F; --sub: #4A5768; --dim: #8A97A8; --accent: #1F6FB2;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--text);
    font-family: system-ui, -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif;
    line-height: 1.6; font-size: 15px;
  }
  .wrap { max-width: 920px; margin: 0 auto; padding: 28px 16px 64px; }
  h1 { font-size: 24px; margin: 0 0 4px; letter-spacing: 0.01em; }
  .lede { color: var(--sub); margin: 0 0 20px; font-size: 14px; }
  .sum { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 22px; }
  .sum div {
    background: var(--card); border: 1px solid var(--line); border-radius: 10px;
    padding: 10px 14px; min-width: 120px; flex: 1 1 auto;
  }
  .sum b { display: block; font-size: 22px; font-variant-numeric: tabular-nums; }
  .sum span { font-size: 12px; color: var(--sub); }
  h2 { font-size: 17px; margin: 32px 0 6px; padding-bottom: 6px; border-bottom: 1px solid var(--line); }
  h2 small { font-weight: 400; color: var(--dim); font-size: 12.5px; margin-left: 8px; }
  .note { color: var(--sub); font-size: 13.5px; margin: 0 0 10px; }
  table { width: 100%; border-collapse: collapse; }
  td { border-bottom: 1px solid var(--line); padding: 12px 8px; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  .shot { width: 76px; }
  .shot img {
    width: 60px; height: 60px; border-radius: 10px; background: var(--card2);
    border: 1px solid var(--line); object-fit: contain; display: block;
  }
  .none {
    display: flex; width: 60px; height: 60px; border-radius: 10px; background: var(--card2);
    border: 1px dashed var(--line2); color: var(--dim); align-items: center; justify-content: center; font-size: 12px;
  }
  .fname {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px;
    color: var(--accent); word-break: break-all;
  }
  .title { font-weight: 700; margin-top: 2px; }
  .desc { color: var(--sub); font-size: 13.5px; margin-top: 2px; }
  .where { color: var(--dim); font-size: 11.5px; margin-top: 3px; word-break: break-all; }
  .tag { width: 96px; text-align: right; }
  .chip {
    display: inline-block; font-size: 11px; font-weight: 700; padding: 2px 9px;
    border-radius: 999px; color: #fff; white-space: nowrap;
  }
  .chip--need { background: var(--need); }
  .chip--opt { background: var(--opt); }
  .chip--no { background: var(--no); }
  .chip--done { background: var(--ok); }
  .ok {
    background: var(--card); border: 1px solid var(--line); border-left: 4px solid var(--ok);
    border-radius: 10px; padding: 12px 14px; color: var(--sub); font-size: 14px;
  }
  .spares { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 8px; margin-top: 10px; }
  .spare { margin: 0; text-align: center; background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 6px 4px; }
  .spare img { width: 44px; height: 44px; object-fit: contain; display: block; margin: 0 auto; }
  .spare figcaption { font-size: 9.5px; color: var(--dim); margin-top: 3px; word-break: break-all; line-height: 1.35; }
  .spec { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; margin-top: 8px; }
  .spec p { margin: 0 0 8px; font-size: 14px; }
  .spec p:last-child { margin-bottom: 0; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; background: var(--card2); padding: 1px 5px; border-radius: 5px; }
  footer { margin-top: 34px; color: var(--dim); font-size: 12px; }
  @media (max-width: 560px) {
    .shot { width: 60px; }
    .shot img, .none { width: 48px; height: 48px; }
    .tag { width: 68px; }
  }
</style>
</head>
<body>
<div class="wrap">
  <h1>WORLD INDUSTRY ― 素材リスト</h1>
  <p class="lede">コードが使っている名前を機械で洗い出したものと、これから作る機能のために手で書き出したものを1枚にまとめました。<strong>赤い「要」から順に描けば十分</strong>です。黄色の「欲しい」は、当面は手持ちの絵で代用できます。</p>

  <div class="sum">
    <div><b>${have.size}</b><span>いまある絵</span></div>
    <div><b>${used.size}</b><span>いま使っている絵</span></div>
    <div><b>${missing.length}</b><span>いま足りない</span></div>
    <div><b>${doneCount}</b><span>届いた</span></div>
    <div><b>${needCount}</b><span>要（描いてほしい）</span></div>
    <div><b>${wantCount}</b><span>欲しい（あると良い）</span></div>
    <div><b>${unused.length}</b><span>手持ちの予備</span></div>
  </div>

  <h2>1. いま足りないもの<small>コードが名前を使っているのに画像が無いもの</small></h2>
  ${missing.length === 0
      ? '<div class="ok">ありません。いま画面に出ている絵はすべて揃っています。</div>'
      : `<table>${missingRows}</table>`}

  <h2>2. これから必要になるもの<small>v2（交通・農業・ミニゲーム・経営）で使う</small></h2>
  <p class="note">左に絵が出ているものは、当面その手持ちの絵で代用します。<strong>「要」の赤いものだけは代わりが無い</strong>ので、優先して描いていただけると助かります。</p>
  <table>${plannedRows}</table>

  <h2>3. あった方が良いもの<small>無くても動くが、あると見栄えと手触りが上がる</small></h2>
  <table>${otherRows}</table>

  <h2>4. 手持ちの予備<small>持っているがまだ使っていない絵。新しく描く前にここを探すと早い</small></h2>
  <p class="note">${unused.length}点あります。農業・物流・季節・天気・工具まわりは、ここでほぼ足ります。</p>
  <div class="spares">${spareCells}</div>

  <h2>絵の決まりごと</h2>
  <div class="spec">
    <p><strong>形式</strong>: PNG・背景は透明・<code>512×512</code>（表示は 24〜40px なので、小さくしても形が分かるように）。</p>
    <p><strong>置き場所</strong>: <code>public/assets/icons/</code> にファイル名そのままで置けば、すぐ画面に出ます。コードは触りません。</p>
    <p><strong>絵柄</strong>: いまある絵に合わせて、少し立体感のある平面イラスト。輪郭ははっきり、影は軽く。黒一色の線画や写真は混ぜないでください。</p>
    <p><strong>色</strong>: 暗い背景と明るい背景の両方に載ります。真っ白・真っ黒だけの絵は避けて、中間の色を必ず入れてください。</p>
    <p><strong>向き</strong>: 乗り物と機械は「左を向く／斜め前から」で揃えています。地図に置く車両だけは「上が進行方向」の真上から。</p>
  </div>

  <footer>自動生成: <code>node docs/make_assets_sheet.mjs</code>／作成日 ${new Date().toISOString().slice(0, 10)}</footer>
</div>
</body>
</html>`;

fs.writeFileSync(OUT, html);
console.log(`書き出しました: ${OUT}`);
console.log(`いまある ${have.size} / 使っている ${used.size} / 足りない ${missing.length} / 予備 ${unused.length}`);
console.log(`済 ${doneCount} / 要 ${needCount} / 欲しい ${wantCount}`);
