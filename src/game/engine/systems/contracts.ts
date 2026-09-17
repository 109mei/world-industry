import { CONFIG } from '@/game/data/config';
import { creditRankOf, type CreditRankDef } from '@/game/data/contracts';
import type { GameState } from '@/types/state';

/** 現在の信用ランクの定義 */
export function creditRankDef(state: GameState): CreditRankDef {
  return creditRankOf(state.contracts?.credit ?? 0);
}

/** 注文システムが解放されているか（累計売上で解放） */
export function isContractsUnlocked(state: GameState): boolean {
  return state.company.totalEarned >= CONFIG.contracts.unlockEarned || (state.contracts?.active.length ?? 0) > 0 || state.stats.contractsCompleted > 0;
}

/** 旧「注文」は v1.0 で「営業・契約・納品」に置き換えた（systems/sales.ts）。
 * ここには信用ランクの計算だけが残っている。 */
