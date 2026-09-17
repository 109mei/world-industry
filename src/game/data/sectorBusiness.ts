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

/** 競合として「一人前」とみなす生産量（個/秒） */
export const COMPETITION_SCALE: Partial<Record<ResourceId, number>> = {
  stone: 200,
  iron_ore: 80,
  coal: 80,
  copper_ore: 40,
  uranium_ore: 8,
  crude_oil: 60,
  wheat: 80,
  iron: 40,
  steel: 25,
  cast_iron: 25,
  concrete: 40,
  brick: 40,
  building_material: 6,
  machine_parts: 15,
  electronics: 8,
  semiconductor: 3,
  silicon: 6,
  car: 1.5,
  robot: 0.6,
  flour: 30,
  fuel: 30,
  nuclear_fuel: 2,
  tool: 20,
  cloth: 20,
  plastic: 20,
  rubber: 20,
};

export const DEFAULT_SCALE = 30;
