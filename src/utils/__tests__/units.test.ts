/**
 * 数量の表示。
 *
 * 「1個」が資源によって 1kg だったり 1g だったり 1個だったりするので、
 * ここが狂うと画面じゅうの数字が嘘になる。それでいて画面のテストは無いので、
 * 書式そのものをここで見張る。
 */
import { describe, expect, it } from 'vitest';
import { RESOURCES, RESOURCE_MAP, type ResourceId } from '@/game/data/resources';
import { capacityNote, formatCapacity, formatQty, formatQtyRate, formatUnitPrice, unitOf } from '../names';

describe('資源の単位', () => {
  it('素材は kg、液体は L、金銀は g、部品と製品は 個', () => {
    expect(unitOf('stone')).toBe('kg');
    expect(unitOf('iron')).toBe('kg');
    expect(unitOf('water')).toBe('L');
    expect(unitOf('crude_oil')).toBe('L');
    expect(unitOf('gold')).toBe('g');
    expect(unitOf('silver')).toBe('g');
    expect(unitOf('tool')).toBe('個');
    expect(unitOf('car')).toBe('個');
  });

  it('知らない ID でも落ちず、「個」として扱う', () => {
    expect(unitOf('no_such_resource')).toBe('個');
    expect(formatQty('no_such_resource', 5)).toBe('5個');
  });

  it('データ側の単位は、決めた4つ以外にならない', () => {
    for (const r of RESOURCES) {
      expect(['kg', 'g', 'L', '個'], `${r.name}の単位がおかしい`).toContain(unitOf(r.id));
    }
  });

  it('カテゴリと単位が食い違っていない', () => {
    for (const r of RESOURCES) {
      const u = unitOf(r.id);
      if (r.category === 'part' || r.category === 'product') {
        expect(u, `${r.name}は数える物なのに重さの単位が付いている`).toBe('個');
      }
    }
  });
});

describe('数量の書き方', () => {
  it('1,000を超えたら繰り上げる（kg→t、L→kL、g→kg）', () => {
    expect(formatQty('stone', 500)).toBe('500kg');
    expect(formatQty('stone', 1_000)).toBe('1t');
    expect(formatQty('stone', 2_500)).toBe('2.5t');
    expect(formatQty('water', 1_000)).toBe('1kL');
    expect(formatQty('gold', 1_000)).toBe('1kg');
    // 個は繰り上げない（1,000個は1,000個のまま、短縮表記にはなる）
    expect(formatQty('tool', 12, 'full')).toBe('12個');
  });

  it('1に満たない量が 0 と出ない（実際は入っているので）', () => {
    expect(formatQty('stone', 0.6)).toBe('0.6kg');
    expect(formatQty('gold', 0.2)).toBe('0.2g');
    expect(formatQty('tool', 0.5)).toBe('0.5個');
    // ちょうど0は 0 のまま
    expect(formatQty('stone', 0)).toBe('0kg');
  });

  it('負の量にも単位が付く', () => {
    expect(formatQty('stone', -500)).toBe('-500kg');
    expect(formatQty('stone', -2_000)).toBe('-2t');
  });

  it('毎秒の量は符号が1つだけ付く', () => {
    expect(formatQtyRate('stone', 12)).toBe('+12kg');
    expect(formatQtyRate('stone', -12)).toBe('-12kg');
    expect(formatQtyRate('stone', 0)).toBe('0kg');
    // 二重に付いていないこと
    expect(formatQtyRate('stone', 12).match(/[+-]/g)?.length).toBe(1);
    expect(formatQtyRate('stone', -12).match(/[+-]/g)?.length).toBe(1);
  });

  it('おかしな数でも表示が壊れない', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const out = formatQty('stone', bad);
      expect(out.includes('NaN'), `NaN がそのまま出た: ${out}`).toBe(false);
      expect(out.includes('undefined')).toBe(false);
    }
  });
});

describe('単価と倉庫の容量', () => {
  it('単価はその資源の単位あたりで出る', () => {
    expect(formatUnitPrice('iron', RESOURCE_MAP.iron.basePrice, 'full')).toBe('95円/kg');
    expect(formatUnitPrice('gold', RESOURCE_MAP.gold.basePrice, 'full')).toBe('18,000円/g');
    expect(formatUnitPrice('tool', RESOURCE_MAP.tool.basePrice, 'full')).toBe('2,500円/個');
  });

  it('容量は重さで見せ、個で数えるものは添え書きで断る', () => {
    expect(formatCapacity(100_000)).toBe('100t');
    expect(formatCapacity(500)).toBe('500kg');
    expect(capacityNote(100_000, 'full')).toContain('100,000個');
  });

  it('全資源で、量・単価・毎秒の表示が空にならない', () => {
    for (const r of RESOURCES) {
      const id = r.id as ResourceId;
      for (const v of [0, 0.5, 1, 999, 1_000, 1_234_567]) {
        expect(formatQty(id, v).length, `${r.name} の ${v} が空`).toBeGreaterThan(0);
        expect(formatQtyRate(id, v).length).toBeGreaterThan(0);
      }
      expect(formatUnitPrice(id, r.basePrice).length).toBeGreaterThan(0);
    }
  });
});
