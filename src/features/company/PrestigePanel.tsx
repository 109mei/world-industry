import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Stat } from '@/components/ui/Stat';
import { CONFIG } from '@/game/data/config';
import { canPrestige, prestigePoints, prestigeSummary } from '@/game/engine/systems/prestige';
import { bumpGame, useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatMoney, formatPercent } from '@/utils/format';
import { sfx } from '@/utils/sfx';

/** COMPANY → 再出発: 会社を売却して永続ボーナスを持ち越す */
export function PrestigePanel() {
  const { state, derived, engine } = useGame();
  const setTab = useUiStore((s) => s.setTab);
  const mode = state.settings.numberFormat;
  const [confirm, setConfirm] = useState(false);
  const p = state.prestige;
  const now = prestigeSummary(p.points);
  const gain = prestigePoints(derived.assets);
  const after = prestigeSummary(p.points + gain);
  const ok = canPrestige(derived.assets);
  const ratio = Math.min(1, derived.assets / CONFIG.prestige.minAssets);

  return (
    <div className="list" style={{ gap: 12 }}>
      <Card>
        <div className="stat-grid stat-grid--4">
          <Stat label="再出発の回数" value={`${p.count}回`} />
          <Stat label="永続ポイント" value={`${p.points}pt`} tone="research" />
          <Stat label="全生産" value={`×${now.production.toFixed(2)}`} tone="profit" />
          <Stat label="研究ポイント" value={`×${now.research.toFixed(2)}`} tone="research" />
        </div>
        <p className="text-sub" style={{ fontSize: 12, marginTop: 8 }}>
          総資産が {formatMoney(CONFIG.prestige.minAssets, 'full')} を超えると会社を売却して再出発できます。ポイント = √(総資産 ÷ 1億円)。1ポイントにつき 全生産 +{formatPercent(CONFIG.prestige.productionPerPoint)}・研究ポイント +{formatPercent(CONFIG.prestige.researchPerPoint)}・開始資金 +{formatMoney(CONFIG.prestige.startingCashPerPoint, 'full')}。
          持ち越すのは実績・設定・会社名・永続ボーナスだけで、資源・施設・土地・研究・不動産・株・マネージャーはすべて初期化されます。
        </p>
      </Card>

      <Card>
        <div className="row row--between text-sub" style={{ fontSize: 12, marginBottom: 4 }}>
          <span>いまの総資産 {formatMoney(derived.assets, mode)}</span>
          <span className="num">{ok ? `売却で +${gain}pt` : `あと ${formatMoney(CONFIG.prestige.minAssets - derived.assets, mode)}`}</span>
        </div>
        <ProgressBar ratio={ratio} tone={ok ? 'profit' : 'research'} size="lg" />
        {ok && (
          <div className="stat-grid stat-grid--4" style={{ marginTop: 10 }}>
            <Stat label="ポイント" value={`${p.points} → ${p.points + gain}`} tone="research" />
            <Stat label="全生産" value={`×${now.production.toFixed(2)} → ×${after.production.toFixed(2)}`} tone="profit" />
            <Stat label="研究" value={`×${now.research.toFixed(2)} → ×${after.research.toFixed(2)}`} />
            <Stat label="次の開始資金" value={formatMoney(after.startingCash, mode)} />
          </div>
        )}
        <div className="btn-row" style={{ marginTop: 12 }}>
          {!confirm ? (
            <Button variant="primary" disabled={!ok} onClick={() => setConfirm(true)}>
              会社を売却して再出発する
            </Button>
          ) : (
            <>
              <Button
                variant="danger"
                onClick={() => {
                  if (engine.prestige()) {
                    sfx('achievement');
                    setConfirm(false);
                    setTab('home');
                  }
                  bumpGame();
                }}
              >
                本当に売却する（元に戻せません）
              </Button>
              <Button variant="secondary" onClick={() => setConfirm(false)}>
                やめる
              </Button>
            </>
          )}
        </div>
      </Card>

      {p.history.length > 0 && (
        <Card>
          <div className="section-title" style={{ marginTop: 0 }}>
            これまでの売却
          </div>
          <div className="list">
            {[...p.history].reverse().map((h, i) => (
              <div key={`${h.at}:${i}`} className="row row--between num" style={{ fontSize: 13 }}>
                <span>{new Date(h.at).toLocaleString('ja-JP')}</span>
                <span>総資産 {formatMoney(h.assets, mode)}</span>
                <span className="text-research">+{h.points}pt</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
