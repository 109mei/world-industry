/**
 * 実在の施設名を「もじった架空名」に変換する。
 *
 * - 同じ入力からは必ず同じ結果になる（セーブや表示がぶれない）
 * - 元の名前は保存しない。呼び出し側は戻り値だけを持つ
 * - 住宅など個人の名前が入りうるものは、そもそも名前を使わない（呼び出し側で判断）
 */

/** 文字列 → 32bit の値（FNV-1a） */
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** カタカナ・ひらがなの置き換え候補（見た目と音が似ているもの） */
const KANA_SWAP: Record<string, string> = {
  ア: 'ワ', イ: 'エ', ウ: 'オ', エ: 'イ', オ: 'ウ',
  カ: 'ガ', キ: 'ギ', ク: 'グ', ケ: 'ゲ', コ: 'ゴ',
  ガ: 'カ', ギ: 'キ', グ: 'ク', ゲ: 'ケ', ゴ: 'コ',
  サ: 'ザ', シ: 'ジ', ス: 'ズ', セ: 'ゼ', ソ: 'ゾ',
  ザ: 'サ', ジ: 'シ', ズ: 'ス', ゼ: 'セ', ゾ: 'ソ',
  タ: 'ダ', チ: 'ヂ', ツ: 'ヅ', テ: 'デ', ト: 'ド',
  ダ: 'タ', デ: 'テ', ド: 'ト',
  ナ: 'ネ', ニ: 'ヌ', ヌ: 'ニ', ネ: 'ナ', ノ: 'ホ',
  ハ: 'バ', ヒ: 'ビ', フ: 'ブ', ヘ: 'ベ', ホ: 'ボ',
  バ: 'パ', ビ: 'ピ', ブ: 'プ', ベ: 'ペ', ボ: 'ポ',
  パ: 'バ', ピ: 'ビ', プ: 'ブ', ペ: 'ベ', ポ: 'ボ',
  マ: 'モ', ミ: 'メ', ム: 'マ', メ: 'ミ', モ: 'ム',
  ヤ: 'ユ', ユ: 'ヨ', ヨ: 'ヤ',
  ラ: 'ロ', リ: 'レ', ル: 'ラ', レ: 'リ', ロ: 'ル',
  ワ: 'ヲ', ヲ: 'ワ', ン: 'ヌ',
  あ: 'わ', い: 'え', う: 'お', え: 'い', お: 'う',
  か: 'が', き: 'ぎ', く: 'ぐ', け: 'げ', こ: 'ご',
  さ: 'ざ', し: 'じ', す: 'ず', せ: 'ぜ', そ: 'ぞ',
  た: 'だ', ち: 'ぢ', つ: 'づ', て: 'で', と: 'ど',
  な: 'ね', に: 'ぬ', ぬ: 'に', ね: 'な', の: 'ほ',
  は: 'ば', ひ: 'び', ふ: 'ぶ', へ: 'べ', ほ: 'ぼ',
  ま: 'も', み: 'め', む: 'ま', め: 'み', も: 'む',
  ら: 'ろ', り: 'れ', る: 'ら', れ: 'り', ろ: 'る',
};

/** 漢字の置き換え候補（字面が似ていて、地名・屋号らしく見えるもの） */
const KANJI_SWAP: Record<string, string> = {
  山: '岳', 川: '河', 田: '畑', 原: '源', 木: '杜', 林: '森', 森: '林',
  上: '丄', 中: '仲', 大: '太', 小: '少', 新: '親', 本: '元', 島: '嶋',
  崎: '﨑', 沢: '澤', 谷: '峪', 屋: '堂', 店: '舗', 工: '功',
  建: '健', 東: '柬', 西: '酉', 南: '楠', 北: '兆',
  海: '湖', 池: '沼', 井: '丼', 城: '塞', 台: '臺', 丘: '岡', 岡: '丘',
  野: '埜', 村: '邑', 町: '街', 市: '巿', 銀: '鉑', 金: '鈑',
  高: '髙', 松: '柗', 竹: '笹', 梅: '桃', 桜: '櫻', 花: '華',
  光: '晄', 電: '雷', 鉄: '鐵', 車: '軋', 食: '飠', 飯: '飰',
  薬: '藥', 医: '毉', 学: '學', 校: '枚', 院: '陰', 堂: '塔',
  交: '佼', 通: '逎', 運: '連', 産: '產', 業: '棠', 会: '會', 社: '祉',
  場: '塲', 穂: '穗', 阪: '坂', 福: '副',
  駅: '駈', 所: '處', 役: '彳', 品: '呂', 館: '舘', 園: '苑', 道: '導',
  橋: '梁', 浜: '濱', 港: '湊', 泉: '洎', 湯: '汤', 温: '瑥',
  劇: '刻', 幸: '倖', 袋: '俵',
};

function swapAt(chars: string[], table: Record<string, string>, seed: number): boolean {
  const idxs: number[] = [];
  for (let i = 0; i < chars.length; i++) if (table[chars[i]]) idxs.push(i);
  if (idxs.length === 0) return false;
  // 先頭は残したいので、候補が2つ以上あるときは先頭以外から選ぶ
  const pool = idxs.length > 1 ? idxs.slice(1) : idxs;
  const at = pool[Math.abs(Math.trunc(seed)) % pool.length];
  const rep = table[chars[at]];
  chars[at] = rep.length > 1 ? rep[0] : rep;
  return true;
}

const LATIN_VOWEL: Record<string, string> = { a: 'e', e: 'a', i: 'y', o: 'u', u: 'o', A: 'E', E: 'A', I: 'Y', O: 'U', U: 'O' };

/** 実名 → もじった架空名。元の名前は返さない */
export function fakeName(real: string): string {
  const src = real.trim();
  if (!src) return '';
  const seed = hash32(src);
  const chars = [...src];
  let changed = swapAt(chars, KANA_SWAP, seed);
  if (!changed) changed = swapAt(chars, KANJI_SWAP, seed >>> 3);
  if (!changed) {
    // ラテン文字: 母音を1つ入れ替える
    const vidx: number[] = [];
    for (let i = 0; i < chars.length; i++) if (LATIN_VOWEL[chars[i]]) vidx.push(i);
    if (vidx.length > 0) {
      const pool = vidx.length > 1 ? vidx.slice(1) : vidx;
      const at = pool[(seed >>> 5) % pool.length];
      chars[at] = LATIN_VOWEL[chars[at]];
      changed = true;
    }
  }
  let out = chars.join('');
  if (!changed || out === src) {
    // どうしても変えられないときは、末尾に一文字足して別物にする
    const tail = ['社', '堂', '舎', '館', '亭'][seed % 5];
    out = src + tail;
  }
  return out;
}

/**
 * 表示用の名前を作る。
 * 住宅や名前のない建物は実名を使わず、用途のラベルだけにする。
 */
export function displayName(real: string | undefined, fallbackLabel: string, useRealAsSource: boolean): string {
  if (!useRealAsSource || !real || !real.trim()) return fallbackLabel;
  return fakeName(real);
}
