/**
 * 場所ごとの需要と供給。
 *
 * 同じ品物でも、街なかと工業地帯と農村では売れ方が違う。
 * 地形と人口から「その場所で何が求められているか」を決めて、
 * 求められているものほど高く・多く売れるようにしている。
 * 逆に、自分が同じ街でいくつも同じ店を出すと、客を取り合って一店あたりは落ちる
 * （その計算は business.ts の competition と、市場の値崩れで行う）。
 */
import type { ResourceId } from './resources';
import type { TerrainId } from './terrain';

/** 地形ごとに「よく売れるもの」と、その効き方 */
export const TERRAIN_DEMAND: Record<TerrainId, Partial<Record<ResourceId, number>>> = {
  city: { food: 1.35, clothing: 1.3, electronics: 1.25, furniture: 1.2, paper: 1.15, battery: 1.15, gem: 1.3, gold: 1.25 },
  industrial: { machine_parts: 1.4, steel: 1.3, fuel: 1.3, wire: 1.2, tool: 1.2, plastic: 1.15 },
  plains: { fertilizer: 1.4, tool: 1.25, fuel: 1.2, water: 1.2, food: 1.1 },
  forest: { tool: 1.3, rope: 1.2, food: 1.15, fuel: 1.15 },
  mountain: { tool: 1.35, fuel: 1.25, rope: 1.2, food: 1.15 },
  desert: { water: 1.6, food: 1.3, cloth: 1.2, fuel: 1.15 },
  coast: { food: 1.25, water: 1.2, rope: 1.2, fuel: 1.15 },
  river: { water: 1.15, food: 1.2, clay: 1.2, brick: 1.15 },
  snow: { fuel: 1.5, clothing: 1.35, food: 1.25, lumber: 1.15 },
};

/** 人口が多いほど、日用品の需要が上がる */
export const POPULATION_GOODS: ResourceId[] = ['food', 'clothing', 'water', 'paper', 'furniture', 'electronics'];
