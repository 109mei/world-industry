import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { GATHER_ACTIONS } from '@/game/data/gathering';
import { PRESTIGE_UPGRADE_MAP, levelOf } from '@/game/data/prestigeTree';
import { RECIPES } from '@/game/data/recipes';
import { previewGather } from '@/game/engine/actions/gather';
import { AUTOMATION_KEYS, AUTOMATION_UPGRADE_ID, autoCraftSlots, automationLevel, automationState, isAutomationOn, isAutomationOwned } from '@/game/engine/systems/automation';
import { isUnlocked } from '@/game/engine/systems/unlocks';
import type { AutomationKey } from '@/types/state';
import { bumpGame, useGame } from '@/stores/gameStore';
import { sfx } from '@/utils/sfx';

const LABEL: Record<AutomationKey, { title: string; hint: string }> = {
  gather: { title: '自動採集', hint: '選んだ採集を、タップしなくても続ける' },
  craft: { title: '自動クラフト', hint: '登録したレシピを材料がある限り作る' },
  deliver: { title: '自動納品', hint: '期限が近い契約を在庫から自動で納める' },
  pitch: { title: '自動営業', hint: '関係の深い取引先から順に営業する（費用がかかる）' },
  survey: { title: '自動調査', hint: '買った土地を、建てられるところまで調べる' },
  build: { title: '自動増設', hint: '所持金の1割までで、安い施設を1台ずつ増やす' },
};

/** 永続アップグレードで買った自動化の ON/OFF */
export function AutomationCard() {
  const { state, engine } = useGame();
  const [openCraft, setOpenCraft] = useState(false);
  const [openGather, setOpenGather] = useState(false);
  const [message, setMessage] = useState('');
  const owned = AUTOMATION_KEYS.filter((k) => isAutomationOwned(state, k));
  const hasBulkSell = levelOf(state.prestige?.upgrades, 'auto_sell') > 0;
  if (owned.length === 0 && !hasBulkSell) return null;
  const a = automationState(state);
  const slots = autoCraftSlots(state);
  const craftable = RECIPES.filter((r) => isUnlocked(state, 'recipe', r.id));
  const gatherable = GATHER_ACTIONS.filter((g) => previewGather(state, g.id).unlocked);

  return (
    <Card>
      <div className="card__head">
        <Icon name="icon_ui_settings" size={32} fallback="自動" />
        <div className="row__grow">
          <div className="card__title">自動化</div>
          <div className="card__sub">再出発で買ったものだけ出てきます。いつでも止められます。</div>
        </div>
      </div>
      <div className="card__body">
        {owned.map((k) => {
          const def = PRESTIGE_UPGRADE_MAP[AUTOMATION_UPGRADE_ID[k]];
          const level = automationLevel(state, k);
          return (
            <div key={k} className="row row--between" style={{ padding: '4px 0' }}>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={isAutomationOn(state, k)}
                  onChange={(e) => {
                    engine.setAutomation(k, e.target.checked);
                    bumpGame();
                  }}
                />
                <span>
                  {LABEL[k].title}
                  <span className="text-sub" style={{ fontSize: 11, marginLeft: 6 }}>
                    {LABEL[k].hint}
                  </span>
                </span>
              </label>
              <Badge tone="research">
                Lv{level}
                {def && def.maxLevel > 1 ? ` / ${def.maxLevel}` : ''}
              </Badge>
            </div>
          );
        })}

        {isAutomationOwned(state, 'craft') && (
          <div style={{ marginTop: 8 }}>
            <Button size="sm" onClick={() => setOpenCraft((v) => !v)}>
              自動で作るもの（{a.recipes.length} / {slots}）{openCraft ? ' ▲' : ' ▼'}
            </Button>
            {openCraft && (
              <div className="grid grid--2" style={{ marginTop: 6 }}>
                {craftable.map((r) => {
                  const on = a.recipes.includes(r.id);
                  return (
                    <label key={r.id} className="switch">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => {
                          if (!engine.toggleAutoRecipe(r.id)) setMessage(`登録できるのは ${slots} 個までです（自動クラフトの段階を上げると増えます）`);
                          else setMessage('');
                          bumpGame();
                        }}
                      />
                      {r.name}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {isAutomationOwned(state, 'gather') && (
          <div style={{ marginTop: 8 }}>
            <Button size="sm" onClick={() => setOpenGather((v) => !v)}>
              自動で採るもの（{a.gathers.length === 0 ? 'すべて' : `${a.gathers.length}種`}）{openGather ? ' ▲' : ' ▼'}
            </Button>
            {openGather && (
              <div className="grid grid--2" style={{ marginTop: 6 }}>
                {gatherable.map((g) => (
                  <label key={g.id} className="switch">
                    <input
                      type="checkbox"
                      checked={a.gathers.length === 0 || a.gathers.includes(g.id)}
                      onChange={() => {
                        engine.toggleAutoGather(g.id);
                        bumpGame();
                      }}
                    />
                    {g.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {hasBulkSell && (
          <div className="btn-row" style={{ marginTop: 8 }}>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                const n = engine.setAllAutoSell(true);
                setMessage(`${n} 種類の資源を自動売却にしました（個数の下限は資源ごとに調整できます）`);
                sfx('sell');
                bumpGame();
              }}
            >
              すべて自動売却にする
            </Button>
            <Button
              size="sm"
              onClick={() => {
                const n = engine.setAllAutoSell(false);
                setMessage(`${n} 種類の自動売却を止めました`);
                bumpGame();
              }}
            >
              すべて止める
            </Button>
          </div>
        )}

        {message && (
          <div className="text-sub" style={{ fontSize: 12, marginTop: 6 }}>
            {message}
          </div>
        )}
      </div>
    </Card>
  );
}
