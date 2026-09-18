import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Stat } from '@/components/ui/Stat';
import { CONFIG } from '@/game/data/config';
import { AUTOMATION_UPGRADES, PRESTIGE_UPGRADES, type PrestigeUpgradeDef, upgradeCost } from '@/game/data/prestigeTree';
import { availablePoints, canPrestige, prestigePoints, spentPoints, startingCash } from '@/game/engine/systems/prestige';
import { bumpGame, useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatMoney } from '@/utils/format';
import { sfx } from '@/utils/sfx';

/** 転生: 会社を売却してポイントを得て、永続アップグレードに使う */
export function PrestigePanel() {
  const { state, derived, engine } = useGame();
  const setTab = useUiStore((s) => s.setTab);
  const mode = state.settings.numberFormat;
  const [confirm, setConfirm] = useState(false);
  const p = state.prestige;
  const gain = prestigePoints(derived.assets);
  const ok = canPrestige(derived.assets);
  const ratio = Math.min(1, derived.assets / CONFIG.prestige.minAssets);
  const available = availablePoints(state);
  const spent = spentPoints(state);

  const renderUpgrade = (u: PrestigeUpgradeDef) => {
    const level = p.upgrades?.[u.id] ?? 0;
    const cost = upgradeCost(u.id, level);
    const maxed = level >= u.maxLevel;
    const canBuy = !maxed && available >= cost;
    return (
      <Card key={u.id} flat>
        <div className="card__head">
          <Icon name={u.icon} size={30} fallback={u.name.slice(0, 2)} />
          <div className="row__grow">
            <div className="card__title">{u.name}</div>
            <div className="card__sub">{u.perLevel}</div>
          </div>
          <Badge tone={maxed ? 'profit' : level > 0 ? 'research' : 'default'}>
            {level} / {u.maxLevel}
          </Badge>
        </div>
        <div className="card__body">
          <ProgressBar ratio={level / u.maxLevel} tone="research" />
          <div className="text-sub" style={{ fontSize: 12, margin: '6px 0' }}>
            {u.description}
          </div>
          <Button
            size="sm"
            block
            variant={canBuy ? 'primary' : 'secondary'}
            disabled={!canBuy}
            onClick={() => {
              if (engine.buyPrestigeUpgrade(u.id)) {
                sfx('research');
                bumpGame();
              }
            }}
          >
            {maxed ? '最大' : `${cost}pt で上げる`}
          </Button>
        </div>
      </Card>
    );
  };

  return (
    <div className="list" style={{ gap: 12 }}>
      {/* 何をするところなのか、開いた瞬間に分かるようにする（分かりにくいと指摘があった） */}
      <div className="section-title" style={{ marginTop: 0 }}>
        転生 — 会社を売って、次の会社を有利に始める
      </div>
      <Card>
        <div className="stat-grid stat-grid--4">
          <Stat label="使えるポイント" value={`${available}pt`} size="lg" tone="research" />
          <Stat label="累計ポイント" value={`${p.points}pt`} extra={`使用済み ${spent}pt`} />
          <Stat label="転生の回数" value={`${p.count}回`} />
          <Stat label="次の開始資金" value={formatMoney(startingCash(state), mode)} />
        </div>
        <p className="text-sub" style={{ fontSize: 12, marginTop: 8 }}>
          総資産が {formatMoney(CONFIG.prestige.minAssets, 'full')} を超えると、会社を売却して転生できます。ポイント = √(総資産 ÷ 1億円)。ポイントは下の永続アップグレードに使い、売却しても残ります。
          持ち越すのは実績・設定・会社名・ポイントとアップグレードだけで、資源・施設・土地・研究・不動産・株はすべて初期化されます。
        </p>
      </Card>

      <div className="section-title">自動化（買うとスイッチが出ます）</div>
      <p className="text-sub" style={{ fontSize: 12, margin: '0 0 4px' }}>
        面倒なところを肩代わりしてくれます。買うとすぐ動きだし、ホームの「自動化」で個別に止められます。
      </p>
      <div className="grid grid--2">
        {AUTOMATION_UPGRADES.map((u) => renderUpgrade(u))}
      </div>

      <div className="section-title">能力の強化</div>
      <div className="grid grid--2">
        {PRESTIGE_UPGRADES.map((u) => renderUpgrade(u))}
      </div>

      <Card>
        <div className="row row--between text-sub" style={{ fontSize: 12, marginBottom: 4 }}>
          <span>いまの総資産 {formatMoney(derived.assets, mode)}</span>
          <span className="num">{ok ? `売却で +${gain}pt` : `あと ${formatMoney(CONFIG.prestige.minAssets - derived.assets, mode)}`}</span>
        </div>
        <ProgressBar ratio={ratio} tone={ok ? 'profit' : 'research'} size="lg" />
        <div className="btn-row" style={{ marginTop: 12 }}>
          {!confirm ? (
            <Button variant="primary" disabled={!ok} onClick={() => setConfirm(true)}>
              会社を売却して転生する
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
