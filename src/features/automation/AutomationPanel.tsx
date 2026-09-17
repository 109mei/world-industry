import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Stat } from '@/components/ui/Stat';
import { CONFIG } from '@/game/data/config';
import { FACILITY_MAP, isFacilityId } from '@/game/data/facilities';
import { MANAGERS } from '@/game/data/managers';
import { RESOURCE_MAP, type ResourceId } from '@/game/data/resources';
import { isManagerHired, isManagerUnlocked, managerSalary, templateCost } from '@/game/engine/systems/automation';
import { describeCondition } from '@/game/engine/systems/unlocks';
import { bumpGame, useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatDuration, formatMoney, formatMoneyRate, formatNumber } from '@/utils/format';
import { NAMES } from '@/utils/names';
import { sfx } from '@/utils/sfx';

/** COMPANY → 自動化: マネージャー・在庫ルール・自動投資・テンプレート */
export function AutomationPanel() {
  const { state, derived, engine } = useGame();
  const openResource = useUiStore((s) => s.openResource);
  const mode = state.settings.numberFormat;
  const a = state.automation;
  const [reserve, setReserve] = useState(String(a.invest.reserve));
  const [payback, setPayback] = useState(String(Math.round(a.invest.maxPaybackSeconds / 60)));
  const hiredCount = MANAGERS.filter((m) => isManagerHired(state, m.id)).length;
  const rules = Object.entries(a.craftTargets) as [ResourceId, number][];
  const sells = (Object.entries(state.market.autoSell) as [ResourceId, { enabled: boolean; keep: number; minPriceRatio?: number }][]).filter(([, c]) => c?.enabled);

  return (
    <div className="list" style={{ gap: 12 }}>
      <Card flat>
        <div className="stat-grid stat-grid--4">
          <Stat label="マネージャー" value={`${hiredCount} / ${MANAGERS.length}人`} />
          <Stat label="給料 /秒" value={formatMoneyRate(-derived.salaryPerSec, mode)} tone={derived.salaryPerSec > 0 ? 'loss' : 'default'} extra={`累計 ${formatMoney(state.stats.salariesPaid, mode)}`} />
          <Stat label="代行した採集" value={`${formatNumber(state.stats.autoGathered, mode)}回`} />
          <Stat label="代行したクラフト" value={`${formatNumber(state.stats.autoCrafted, mode)}回`} />
        </div>
        <p className="text-sub" style={{ fontSize: 12, marginTop: 8 }}>
          担当者を雇うと、その分野が自動で回ります。給料は総資産に応じて上がります（基本額 + 総資産 × {CONFIG.automation.salaryAssetRate * 1e6} 円/秒 per 100万円）。所持金が 0 になると働きません。
        </p>
      </Card>

      <div className="section-title">マネージャー</div>
      <div className="grid grid--2">
        {MANAGERS.map((m) => {
          const hired = isManagerHired(state, m.id);
          const unlocked = isManagerUnlocked(state, m.id, derived.assets);
          const salary = managerSalary(m, derived.assets);
          return (
            <Card key={m.id} locked={!unlocked}>
              <div className="card__head">
                <Icon name={m.icon} size={40} fallback={m.name.slice(0, 2)} />
                <div className="row__grow">
                  <div className="card__title">
                    {m.name} {hired && <Badge tone="profit">勤務中</Badge>}
                  </div>
                  <div className="card__sub num">
                    採用費 {formatMoney(m.hireCost, 'full')}・給料 {formatMoneyRate(salary, mode).replace(/^\+/, '')}
                  </div>
                </div>
              </div>
              <p className="card__sub" style={{ marginTop: 8 }}>
                {m.description}
              </p>
              <ul className="duties">
                {m.duties.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
              {!unlocked ? (
                <div className="card__actions">
                  <Badge tone="warn">解放条件: {describeCondition(m.unlock, NAMES)}</Badge>
                </div>
              ) : hired ? (
                <div className="card__actions btn-row">
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      engine.fireManager(m.id);
                      bumpGame();
                    }}
                  >
                    解雇する
                  </Button>
                  {m.id === 'sales' && (
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={a.smartSell}
                        onChange={(e) => {
                          engine.setSmartSell(e.target.checked);
                          bumpGame();
                        }}
                      />
                      <span className="text-sub" style={{ fontSize: 12 }}>
                        おまかせ販売
                      </span>
                    </label>
                  )}
                </div>
              ) : (
                <div className="card__actions">
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={state.company.cash < m.hireCost}
                    onClick={() => {
                      if (engine.hireManager(m.id)) sfx('buy');
                      bumpGame();
                    }}
                  >
                    雇う（{formatMoney(m.hireCost, mode)}）
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <div className="section-title">在庫ルール</div>
      <Card>
        <p className="text-sub" style={{ fontSize: 12 }}>
          各資源の詳細（資源をタップ）で設定します。「キープ」はクラフト係、「自動売却」と「下限価格」は販売係が実行します。
        </p>
        {rules.length === 0 && sells.length === 0 && <div className="empty">ルールはまだありません。</div>}
        <div className="list" style={{ marginTop: 8 }}>
          {rules.map(([rid, n]) => (
            <div key={`k:${rid}`} className="row row--between" style={{ fontSize: 13 }}>
              <span className="row" style={{ gap: 6 }}>
                <Icon name={RESOURCE_MAP[rid].icon} size={18} /> {RESOURCE_MAP[rid].name}
              </span>
              <span className="num text-sub">
                キープ {formatNumber(n, 'full')}{!isManagerHired(state, 'craft') && <span className="text-warn">（クラフト係が未採用）</span>}
              </span>
              <Button size="sm" variant="ghost" onClick={() => openResource(rid)}>
                変更
              </Button>
            </div>
          ))}
          {sells.map(([rid, c]) => (
            <div key={`s:${rid}`} className="row row--between" style={{ fontSize: 13 }}>
              <span className="row" style={{ gap: 6 }}>
                <Icon name={RESOURCE_MAP[rid].icon} size={18} /> {RESOURCE_MAP[rid].name}
              </span>
              <span className="num text-sub">
                {formatNumber(c.keep, 'full')} を超えた分を売る{c.minPriceRatio ? `・下限 ${Math.round(c.minPriceRatio * 100)}%` : ''}
              </span>
              <Button size="sm" variant="ghost" onClick={() => openResource(rid)}>
                変更
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <div className="section-title">利益の自動投資（投資係）</div>
      <Card>
        <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label className="field" style={{ flex: 1, minWidth: 140 }}>
            <span className="field__label">手元に残す現金（円）</span>
            <input className="input input--sm num" type="number" inputMode="numeric" min={0} value={reserve} onChange={(e) => setReserve(e.target.value)} />
          </label>
          <label className="field" style={{ flex: 1, minWidth: 140 }}>
            <span className="field__label">施設の回収時間の上限（分）</span>
            <input className="input input--sm num" type="number" inputMode="numeric" min={1} value={payback} onChange={(e) => setPayback(e.target.value)} />
          </label>
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              engine.updateInvestRule({ reserve: Math.max(0, Number(reserve) || 0), maxPaybackSeconds: Math.max(60, (Number(payback) || 60) * 60) });
              bumpGame();
            }}
          >
            設定
          </Button>
        </div>
        <div className="btn-row" style={{ marginTop: 10 }}>
          {(
            [
              ['facilities', '回収の早い施設を建てる'],
              ['dividends', '配当を株に再投資'],
              ['properties', '利回りの良い物件を買う'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="switch">
              <input
                type="checkbox"
                checked={a.invest[key]}
                onChange={(e) => {
                  engine.updateInvestRule({ [key]: e.target.checked });
                  bumpGame();
                }}
              />
              <span className="text-sub" style={{ fontSize: 12 }}>
                {label}
              </span>
            </label>
          ))}
        </div>
        <div className="text-sub num" style={{ fontSize: 12, marginTop: 8 }}>
          いまの設定: 現金 {formatMoney(a.invest.reserve, mode)} を超えた分の {Math.round(CONFIG.automation.investBudgetRatio * 100)}% までを1回に投資・回収 {formatDuration(a.invest.maxPaybackSeconds)} 以内の施設
          {a.dividendPool > 0 ? `・再投資待ちの配当 ${formatMoney(a.dividendPool, mode)}` : ''}
          {!isManagerHired(state, 'invest') && <span className="text-warn">（投資係が未採用のため動きません）</span>}
        </div>
      </Card>

      <div className="section-title">土地のテンプレート</div>
      <Card>
        <p className="text-sub" style={{ fontSize: 12 }}>
          土地の詳細（LAND → 土地をタップ）で施設構成を保存し、別の土地に同じ構成で建てられます。
        </p>
        {a.templates.length === 0 && <div className="empty">テンプレートはまだありません。</div>}
        <div className="list" style={{ marginTop: 8 }}>
          {a.templates.map((t) => (
            <div key={t.id} className="row row--between" style={{ fontSize: 13, flexWrap: 'wrap' }}>
              <div className="row__grow">
                <div style={{ fontWeight: 700 }}>{t.name}</div>
                <div className="text-sub num" style={{ fontSize: 12 }}>
                  {Object.entries(t.facilities)
                    .map(([id, n]) => `${isFacilityId(id) ? FACILITY_MAP[id].name : id}×${n}`)
                    .join('・')}
                  {state.lands.length > 1 ? `・新しい土地に建てると約 ${formatMoney(templateCost(state, t, state.lands[state.lands.length - 1].id), mode)}` : ''}
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  engine.deleteTemplate(t.id);
                  bumpGame();
                }}
              >
                削除
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
