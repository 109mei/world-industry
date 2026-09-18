/*
 * 必要な素材を1枚にまとめたシートを作る。
 * コードが参照しているアイコン名を全部洗い出し、assets/icons にあるものと突き合わせて、
 * 足りないものだけを「何を描けばいいか」つきで並べる。
 */
const fs = require('fs');
const path = require('path');

const SRC = 'app/src';
const ICONS = 'app/public/assets/icons';
const OUT = process.argv[2] || 'assets-needed.html';

const have = new Set(
  fs.readdirSync(ICONS).filter((f) => f.endsWith('.png')).map((f) => f.replace(/\.png$/, '')),
);

// コードの中の 'icon_xxx' をすべて集める
const used = new Map();
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (!/\.(ts|tsx)$/.test(e.name)) continue;
    const s = fs.readFileSync(p, 'utf8');
    const re = /['"`](icon_[a-z0-9_]+)['"`]/g;
    let m;
    while ((m = re.exec(s))) {
      if (!used.has(m[1])) used.set(m[1], new Set());
      used.get(m[1]).add(p.replace(SRC + '/', ''));
    }
  }
})(SRC);

// いま使っている「代わりのアイコン」表
const fallbackSrc = fs.readFileSync(path.join(SRC, 'utils/assets.ts'), 'utf8');
const FALLBACK = {};
for (const m of fallbackSrc.matchAll(/^\s*(icon_[a-z0-9_]+):\s*'(icon_[a-z0-9_]+)',/gm)) FALLBACK[m[1]] = m[2];

const missing = [...used.keys()].filter((n) => !have.has(n)).sort();

// 何を描けばいいか（足りないものの説明）
const BRIEF = {
  icon_part_gpu: ['GPU（グラフィックボード）', '基板に大きな冷却ファンが2つ並んだ板状の部品。横向き、斜め上から。黒〜濃紺の基板に金色の端子。', '転売・マイニング'],
  icon_product_crypto: ['暗号資産のコイン', '金属光沢のある丸いコイン1枚。表に回路のような模様。金色より少し冷たい色（シルバーゴールド）にすると金と見分けがつく。', '転売・マイニング'],
  icon_facility_gpu_factory: ['GPU工場', 'GPUの基板が流れるベルトコンベアのある工場。既存の「半導体工場」と並べても区別がつくよう、緑の基板より板状のカードを強調。', '施設'],
  icon_facility_mining_rig: ['マイニング装置', '金属フレームにGPUを6枚ほど縦に並べて挿し、ケーブルが垂れているむき出しの装置。', '施設'],
  icon_card_pack: ['カードパック（普通）', '未開封のトレカのパック。銀色の袋に光沢。縦長、少し斜めに。', 'カード'],
  icon_card_pack_premium: ['カードパック（プレミアム）', '同じ形で金色・箔押し風。普通のパックと一目で違いが分かるように。', 'カード'],
  icon_card_box: ['カードの箱（20パック入り）', 'パックが詰まった紙箱。フタが少し開いて中のパックが見えている。', 'カード'],
  icon_commercial_casino: ['カジノ', 'ネオンの看板が付いた建物。既存の「モール」と区別がつくよう、電飾とアーチを強調。', 'カード・事業'],
  icon_commercial_skyscraper: ['高層ビル', 'ガラス張りの細長い高層ビル1棟。既存の「オフィス」より明らかに高く。', 'カード・事業'],
  icon_slot_grape: ['スロットの絵柄：ぶどう', 'スロット台の絵柄らしく、輪郭のはっきりした紫のぶどう。正面向き・左右対称ぎみ。', 'スロット'],
  icon_slot_bell: ['スロットの絵柄：ベル', '金色のベル。正面向き。', 'スロット'],
  icon_slot_orange: ['スロットの絵柄：オレンジ', 'オレンジ1個と葉。正面向き。', 'スロット'],
  icon_slot_seven: ['スロットの絵柄：7', '赤い「7」の数字。太く、縁取りつき。', 'スロット'],
  icon_slot_jackpot: ['スロットの絵柄：ジャックポット', '王冠か「JACKPOT」の文字板。いちばん派手に。', 'スロット'],
  icon_slot_blank: ['スロットの絵柄：はずれ', '無地の記号（青いバーなど）。地味でよい。揃っても当たりに見えないもの。', 'スロット'],
};

// アイコン以外で、あると良いもの
const OTHERS = [
  ['パチンコ台の盤面', 'PNG または SVG / 600×840 目安', 'いまは釘と入賞口を図形で描いている。木枠・ランプ・役物の描かれた背景板が1枚あると一気に本物らしくなる。中央 44〜56%（横）に入賞口、上40%にデジタル表示の窓を空けておく。', 'あると良い'],
  ['スロット台の枠', 'PNG / 900×600 目安', '3つのリール窓を囲む枠。窓の位置は左右3等分・中央に当たりライン。', 'あると良い'],
  ['ルーレット盤の中心', 'PNG / 400×400', 'いまは数字を並べたSVGで描いている。中心の金属ハブだけ画像にすると質感が出る。', 'あると良い'],
  ['トランプの絵札（J・Q・K）', 'PNG / 各 240×340', 'バカラで J・Q・K を文字で出している。絵札があると見栄えする（A〜10は文字のままでよい）。', 'あると良い'],
  ['カードのイラスト 26枚', 'PNG / 各 256×256', 'いまは資源・施設のアイコンを流用している。カード専用の絵にすると「集めたくなる」度が大きく上がる。UR「ワールド・インダストリー」だけでも専用絵があると効く。', 'あると良い'],
  ['アプリのアイコン', 'PNG / 192×192・512×512', 'manifest.webmanifest 用。ホーム画面に置いたときの見た目。', 'あると良い'],
  ['共有用の画像（OGP）', 'PNG / 1200×630', 'URLを共有したときに出るサムネイル。', 'あると良い'],
  ['効果音', '不要', '効果音はファイルを使わず、その場で音を合成している（Web Audio）。差し替えたい場合のみ WAV/OGG が要る。', '不要'],
  ['BGM', 'OGG / ループ可', '現状BGMはなし。入れるなら1〜2分のループを2〜3曲（通常・工場・カジノ）。', '任意'],
];

const dataUri = (name) => {
  const p = path.join(ICONS, name + '.png');
  if (!fs.existsSync(p)) return '';
  return 'data:image/png;base64,' + fs.readFileSync(p).toString('base64');
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const rows = missing
  .map((name) => {
    const b = BRIEF[name] || ['（用途未整理）', '', ''];
    const fb = FALLBACK[name];
    const where = [...(used.get(name) || [])].slice(0, 3).join(' / ');
    return `<tr>
      <td class="shot">${fb ? `<img src="${dataUri(fb)}" alt="いまの代わり">` : '<span class="none">なし</span>'}</td>
      <td>
        <div class="fname">${esc(name)}.png</div>
        <div class="title">${esc(b[0])}</div>
        <div class="desc">${esc(b[1])}</div>
        <div class="where">使う場所: ${esc(where)}</div>
        ${fb ? `<div class="where">いまの代わり: ${esc(fb)}.png</div>` : ''}
      </td>
      <td class="tag"><span class="chip chip--need">要</span><div class="group">${esc(b[2])}</div></td>
    </tr>`;
  })
  .join('\n');

const others = OTHERS.map(
  ([name, spec, desc, tag]) => `<tr>
    <td class="shot"><span class="none">—</span></td>
    <td>
      <div class="title">${esc(name)}</div>
      <div class="desc">${esc(desc)}</div>
      <div class="where">形式: ${esc(spec)}</div>
    </td>
    <td class="tag"><span class="chip chip--${tag === '不要' ? 'no' : 'opt'}">${esc(tag)}</span></td>
  </tr>`,
).join('\n');

const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>WORLD INDUSTRY 必要な素材</title>
<style>
  :root {
    --bg: #0E1116; --card: #171C24; --card2: #1E242E; --line: #2A323E; --line2: #3A4554;
    --text: #E8EDF4; --sub: #A9B4C4; --dim: #6B7684;
    --need: #C0392B; --opt: #C08A00; --no: #6B7684; --accent: #0072B2;
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
  .wrap { max-width: 880px; margin: 0 auto; padding: 28px 16px 64px; }
  h1 { font-size: 24px; margin: 0 0 4px; letter-spacing: 0.01em; }
  .lede { color: var(--sub); margin: 0 0 20px; font-size: 14px; }
  .sum { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 22px; }
  .sum div {
    background: var(--card); border: 1px solid var(--line); border-radius: 10px;
    padding: 10px 14px; min-width: 128px; flex: 1 1 auto;
  }
  .sum b { display: block; font-size: 22px; font-variant-numeric: tabular-nums; }
  .sum span { font-size: 12px; color: var(--sub); }
  h2 { font-size: 17px; margin: 30px 0 10px; padding-bottom: 6px; border-bottom: 1px solid var(--line); }
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
  .tag { width: 92px; text-align: right; }
  .chip {
    display: inline-block; font-size: 11px; font-weight: 700; padding: 2px 9px;
    border-radius: 999px; color: #fff; white-space: nowrap;
  }
  .chip--need { background: var(--need); }
  .chip--opt { background: var(--opt); }
  .chip--no { background: var(--no); }
  .group { font-size: 11px; color: var(--dim); margin-top: 4px; }
  .spec {
    background: var(--card); border: 1px solid var(--line); border-radius: 12px;
    padding: 14px 16px; margin-top: 8px;
  }
  .spec p { margin: 0 0 8px; font-size: 14px; }
  .spec p:last-child { margin-bottom: 0; }
  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px;
    background: var(--card2); padding: 1px 5px; border-radius: 5px;
  }
  footer { margin-top: 34px; color: var(--dim); font-size: 12px; }
  @media (max-width: 560px) {
    .shot { width: 60px; }
    .shot img, .none { width: 48px; height: 48px; }
    .tag { width: 64px; }
  }
</style>
</head>
<body>
<div class="wrap">
  <h1>WORLD INDUSTRY ― 必要な素材</h1>
  <p class="lede">コードが参照している名前を機械的に洗い出して作りました。上の表のものが揃えば、いま画像が出ていないところが全部埋まります。</p>

  <div class="sum">
    <div><b>${have.size}</b><span>いまある画像</span></div>
    <div><b>${used.size}</b><span>コードが使う名前</span></div>
    <div><b>${missing.length}</b><span>足りないもの</span></div>
    <div><b>${OTHERS.filter((o) => o[3] === 'あると良い').length}</b><span>あると良いもの</span></div>
  </div>

  <div class="spec">
    <p><strong>仕様</strong>：<code>128 × 128</code> の PNG、背景は透明。置き場所は <code>public/assets/icons/</code>、ファイル名は下の名前そのまま（拡張子 <code>.png</code>）。</p>
    <p><strong>絵柄</strong>：いまある458枚と同じ、<strong>斜め上から見た立体的な実物寄り</strong>の描き方。縁取りやフラットな塗りではなく、影と金属・樹脂の質感がある感じ。1枚 7KB 前後（重くても 12KB まで）。</p>
    <p><strong>置けば自動で切り替わります</strong>：いま足りないものは「近い意味の既存アイコン」を仮に出しています。本物のファイルを置いた瞬間にそちらが優先されるので、コードを触る必要はありません。</p>
  </div>

  <h2>足りないもの（${missing.length}点）</h2>
  <table><tbody>
${rows || '<tr><td colspan="3" class="desc">足りないものはありません。</td></tr>'}
  </tbody></table>

  <h2>アイコン以外で、あると良いもの</h2>
  <table><tbody>
${others}
  </tbody></table>

  <footer>
    左端の画像は「いま代わりに出ているもの」です。<br>
    この一覧は <code>make_assets_sheet.js</code> がコードから自動で作っています。機能を足したら作り直せば最新になります。
  </footer>
</div>
</body>
</html>`;

fs.writeFileSync(OUT, html);
console.log('wrote', OUT, 'missing', missing.length, 'bytes', fs.statSync(OUT).size);
