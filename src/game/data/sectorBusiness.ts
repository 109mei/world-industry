/**
 * 業種ごとの「商売のタネ」。プレイヤーの生産・所有がどの会社に効くかを決める。
 * 自分がたくさん作るほどその業種の会社は苦しくなり（競合）、
 * 買い手の業種には安く材料が入るので追い風になる。
 */
import type { Sector } from './companies';
import type { ResourceId } from './resources';

/** その業種が売っているもの（プレイヤーが作ると競合になる） */
export const SECTOR_PRODUCES: Record<Sector, ResourceId[]> = {
  realestate: [],
  energy: ['fuel', 'nuclear_fuel', 'crude_oil'],
  mining: ['iron_ore', 'coal', 'copper_ore', 'uranium_ore', 'stone'],
  construction: ['building_material', 'concrete', 'brick'],
  logistics: [],
  food: ['flour', 'wheat'],
  shipping: [],
  finance: [],
  heavy: ['machine_parts', 'steel', 'robot'],
  airline: [],
  it: ['electronics'],
  semiconductor: ['semiconductor', 'silicon'],
  trading: ['tool', 'cloth', 'plastic'],
  auto: ['car'],
  agri: ['wheat', 'rubber'],
  hotel: [],
  steel: ['steel', 'iron', 'cast_iron'],
};

/** その業種が仕入れるもの（プレイヤーが大量に作ると追い風になる） */
export const SECTOR_INPUTS: Record<Sector, ResourceId[]> = {
  realestate: ['building_material', 'concrete', 'brick'],
  energy: ['coal', 'crude_oil', 'uranium_ore'],
  mining: ['machine_parts', 'fuel', 'steel'],
  construction: ['concrete', 'brick', 'steel', 'lumber'],
  logistics: ['fuel', 'tire', 'machine_parts'],
  food: ['wheat', 'water'],
  shipping: ['fuel', 'steel'],
  finance: [],
  heavy: ['steel', 'iron', 'copper'],
  airline: ['fuel', 'electronics'],
  it: ['semiconductor', 'wire', 'plastic'],
  semiconductor: ['silicon', 'copper', 'chemical'],
  trading: ['food', 'clothing', 'furniture'],
  auto: ['steel', 'machine_parts', 'tire', 'battery', 'paint'],
  agri: ['fertilizer', 'water', 'fuel'],
  hotel: ['food', 'cloth', 'furniture'],
  steel: ['iron_ore', 'coal', 'scrap_metal'],
};

/**
 * 競合として「一人前」とみなす生産量（個/秒）。
 * 世界は広いので、少し作ったくらいでは業界は動かない（v1.1 で10倍に引き上げ）。
 */
export const COMPETITION_SCALE: Partial<Record<ResourceId, number>> = {
  stone: 2000,
  iron_ore: 800,
  coal: 800,
  copper_ore: 400,
  uranium_ore: 80,
  crude_oil: 600,
  wheat: 800,
  iron: 400,
  steel: 250,
  cast_iron: 250,
  concrete: 400,
  brick: 400,
  building_material: 60,
  machine_parts: 150,
  electronics: 80,
  semiconductor: 30,
  silicon: 60,
  car: 15,
  robot: 6,
  flour: 300,
  fuel: 300,
  nuclear_fuel: 20,
  tool: 200,
  cloth: 200,
  plastic: 200,
  rubber: 200,
};

export const DEFAULT_SCALE = 300;
