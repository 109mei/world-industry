import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Stat } from '@/components/ui/Stat';
import { CONTRACT_STEPS, gridPricePerMWh } from '@/game/data/power';
import { COUNTRY_NAME } from '@/game/data/lands';
import { gridCountry } from '@/game/engine/systems/power';
import { bumpGame, useGame } from '@/stores/gameStore';
import { formatMoney, formatMoneyRate, formatPercent } from '@/utils/format';
import { formatMW } from '@/utils/names';

/** 電力の需給。発電所か電力を使う施設が1つでもあれば表示する */
export function PowerSummary() {
  const { state, derived, engine } = useGame();
  const p = derived.power;
  const mode = state.settings.numberFormat;
  const contract = p.contractMW;
  if (p.capacity <= 0 && p.demand <= 0 && contract <= 0) return null;
  const tone = p.demand <= 0 ? 'default' : p.ratio >= 0.999 ? 'profit' : p.ratio > 0 ? 'warn' : 'loss';
  const country = gridCountry(state);
  const price = gridPricePerMWh(country);
  const selfGen = Math.max(0, p.generation - p.purchased);
  // 契約したのに使っていない容量（基本料金だけ払っている状態）
  const idleContract = Math.max(0, contract - p.purchased);

  return (
    <Card>
      <div className="card__head">
        <Icon name="icon_ui_power" size={32} fallback="⚡" />
        <div className="row__grow">
          <div className="card__title">電力</div>
          <div className="card__sub">需要ぶんだけ発電し、燃料を使います。足りないと電力を使う施設の稼働率が下がります。</div>
        </div>
      </div>
      <div className="stat-grid stat-grid--4" style={{ marginTop: 8 }}>
        <Stat label="発電能力" value={formatMW(p.capacity)} tone="power" extra={contract > 0 ? `自前 ${formatMW(p.capacity - contract)}＋契約 ${formatMW(contract)}` : undefined} />
        <Stat label="需要" value={formatMW(p.demand)} />
        <Stat label="発電中" value={formatMW(selfGen)} extra={p.purchased > 0 ? `買った電気 ${formatMW(p.purchased)}` : undefined} />
        <Stat label="供給率" value={formatPercent(p.ratio)} tone={tone} />
      </div>
      <div style={{ marginTop: 8 }}>
        <ProgressBar ratio={p.capacity > 0 ? p.demand / p.capacity : 1} tone={p.demand > p.capacity ? 'loss' : p.demand > p.capacity * 0.85 ? 'warn' : 'accent'} label="発電能力に対する需要" />
        <div className="text-sub num" style={{ fontSize: 12, marginTop: 4 }}>
          発電能力の {formatPercent(p.capacity > 0 ? p.demand / p.capacity : 0)} を使用
        </div>
      </div>

      <div className="card__body" style={{ marginTop: 10 }}>
        <div className="field__label">電力会社から買う</div>
        <div className="text-sub" style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 6 }}>
          発電所を建てなくても、電力会社と契約すれば電気を使えます。料金は
          <strong>基本料金（契約した容量ぶん、使わなくてもかかる）</strong>と<strong>従量料金（使ったぶん）</strong>の2本立てです。
          自前で発電するより割高なので、発電所が建つまでのつなぎか、足りないぶんの補いに向いています。
        </div>
        <div className="rm__radius-opts" role="group" aria-label="契約する容量">
          {CONTRACT_STEPS.map((mw) => (
            <button
              key={mw}
              className={`rm__radius-btn${contract === mw ? ' rm__radius-btn--on' : ''}`}
              onClick={() => {
                engine.setPowerContract(mw);
                bumpGame();
              }}
            >
              {mw === 0 ? '契約しない' : formatMW(mw)}
            </button>
          ))}
        </div>
        <div className="stat-grid stat-grid--4" style={{ marginTop: 8 }}>
          <Stat label="契約容量" value={contract > 0 ? formatMW(contract) : 'なし'} />
          <Stat label="買っている電気" value={formatMW(p.purchased)} tone={p.purchased > 0 ? 'power' : 'default'} />
          <Stat label="電気代" value={formatMoneyRate(-p.cost, mode)} tone={p.cost > 0 ? 'loss' : 'default'} extra={p.cost > 0 ? `1時間で ${formatMoney(p.cost * 3600, mode)}` : undefined} />
          <Stat label="単価" value={`${formatMoney(price, mode)}/MWh`} extra={`${COUNTRY_NAME[country]}の値段`} />
        </div>
        {idleContract > 0 && contract > 0 && (
          <div className="text-sub" style={{ fontSize: 12, marginTop: 6, lineHeight: 1.6 }}>
            契約のうち <strong>{formatMW(idleContract)}</strong> は使っていません。使わなくても基本料金はかかるので、
            余っているなら契約を小さくしたほうが安くなります。
          </div>
        )}
      </div>
    </Card>
  );
}
