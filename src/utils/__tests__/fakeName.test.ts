import { describe, expect, it } from 'vitest';
import { displayName, fakeName } from '../fakeName';

describe('fakeName', () => {
  const samples = ['セブンイレブン 飯塚店', 'ローソン', 'ファミリーマート', 'マクドナルド', 'ゆめタウン飯塚', '飯塚病院', '九州工業大学', 'イオンモール', 'Starbucks Coffee', 'Tokyo Skytree', '田川市役所', 'JR飯塚駅'];

  it('同じ入力からは同じ結果になる', () => {
    for (const s of samples) expect(fakeName(s)).toBe(fakeName(s));
  });

  it('必ず元の名前と違う', () => {
    for (const s of samples) expect(fakeName(s)).not.toBe(s);
  });

  it('長さはだいたい元のまま（見て分かる程度に残す）', () => {
    for (const s of samples) {
      const f = [...fakeName(s)];
      expect(f.length).toBeGreaterThanOrEqual([...s].length - 1);
      expect(f.length).toBeLessThanOrEqual([...s].length + 2);
    }
  });

  it('先頭の文字は残す', () => {
    for (const s of samples) expect([...fakeName(s)][0]).toBe([...s][0]);
  });

  it('空文字は空文字', () => {
    expect(fakeName('')).toBe('');
    expect(fakeName('   ')).toBe('');
  });

  it('住宅など名前を使わないものはラベルだけになる', () => {
    expect(displayName('山田邸', '住宅', false)).toBe('住宅');
    expect(displayName(undefined, '倉庫', true)).toBe('倉庫');
    expect(displayName('ローソン', 'コンビニ', true)).not.toContain('ローソン');
  });
});
