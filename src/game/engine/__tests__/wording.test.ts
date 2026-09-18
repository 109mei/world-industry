/**
 * 言葉づかいの見張り。
 *
 * 同じものが画面によって違う書き方になっていると、それだけで雑に見える。
 * 本人から指定のあった表記を、ソースごと機械的に固定する。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(process.cwd(), 'src');

function allSources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      allSources(full, out);
      continue;
    }
    if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

const FILES = allSources(SRC);

/** 使ってはいけない書き方 → 正しい書き方 */
const BANNED: { bad: RegExp; good: string; note: string }[] = [
  { bad: /か所/g, good: 'ヵ所', note: '場所の数え方' },
  { bad: /か国/g, good: 'ヵ国', note: '国の数え方' },
  { bad: /ヶ所/g, good: 'ヵ所', note: '場所の数え方（大きいヶは使わない）' },
  { bad: /ヶ国/g, good: 'ヵ国', note: '国の数え方（大きいヶは使わない）' },
  { bad: /カ所/g, good: 'ヵ所', note: '場所の数え方（全角カは使わない）' },
  { bad: /カ国/g, good: 'ヵ国', note: '国の数え方（全角カは使わない）' },
];

describe('言葉づかい', () => {
  it('数え方の表記がそろっている', () => {
    const bad: string[] = [];
    for (const file of FILES) {
      // この見張り自身は、悪い例をわざと書いているので飛ばす
      if (file.endsWith('wording.test.ts')) continue;
      const text = readFileSync(file, 'utf8');
      for (const rule of BANNED) {
        rule.bad.lastIndex = 0;
        if (rule.bad.test(text)) {
          bad.push(`${file.replace(SRC, 'src')}: ${rule.bad.source} → ${rule.good}（${rule.note}）`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('ひらがなの表記ゆれを画面に出していない（「すべて」に統一）', () => {
    const bad: string[] = [];
    for (const file of FILES) {
      if (file.endsWith('wording.test.ts')) continue;
      if (/ぜんぶ/.test(readFileSync(file, 'utf8'))) bad.push(file.replace(SRC, 'src'));
    }
    expect(bad).toEqual([]);
  });
});
