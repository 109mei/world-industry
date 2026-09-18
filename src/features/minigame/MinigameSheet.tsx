import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Sheet } from '@/components/ui/Sheet';
import { Stat } from '@/components/ui/Stat';
import { BONUS_SCORE, MINIGAME_MAP, SKILL_MAP, expToNext, rewardMultiplier, type MinigameId } from '@/game/data/minigames';
import { RESOURCE_MAP } from '@/game/data/resources';
import { skillOf, skillProgress, type MinigameResult } from '@/game/engine/systems/minigame';
import { bumpGame, useGame } from '@/stores/gameStore';
import { formatPercent } from '@/utils/format';
import { formatQty } from '@/utils/names';
import { DigGame } from './DigGame';
import { GrowGame } from './GrowGame';
import { SortGame } from './SortGame';
import { TimingGame } from './TimingGame';

interface Props {
  gameId: MinigameId | null;
  onClose: () => void;
}

/**
 * ミニゲームを1回ぶん遊ぶ画面。
 *
 * 初めての遊びでは、いきなり始めずに「やり方」から出す。
 * 一度でも遊んでいれば飛ばし、下の「やり方をもう一度」からいつでも読み返せる。
 * 遊んだ回数をそのまま見ているので、覚えておくための項目を増やしていない。
 */
export function MinigameSheet({ gameId, onClose }: Props) {
  const { state, engine } = useGame();
  const mode = state.settings.numberFormat;
  const [result, setResult] = useState<{ score: number; r: MinigameResult } | null>(null);
  // 「もう一度」でゲームの中身を作り直すための番号
  const [round, setRound] = useState(0);
  const firstTime = gameId ? skillOf(state, MINIGAME_MAP[gameId].skill).plays === 0 : false;
  const [howto, setHowto] = useState(firstTime);

  const finish = useCallback(
    (score: number) => {
      if (!gameId) return;
      const r = engine.playMinigame(gameId, score);
      setResult({ score, r });
      bumpGame();
    },
    [engine, gameId],
  );

  if (!gameId) return null;
  const def = MINIGAME_MAP[gameId];
  const skill = SKILL_MAP[def.skill];
  const st = skillOf(state, def.skill);
  const capped = st.level >= skill.maxLevel;

  /** やり方（初めてのときと、読み返したいとき） */
  const howtoBody = () => (
    <>
      <div className="sheet__section">
        <div className="guide__badge">やり方</div>
        <p className="guide__p">{def.description}</p>
        <div className="guide__points" style={{ marginTop: 10 }}>
          {def.howto.map((h) => (
            <div key={h.label} className="guide__point">
              <div className="guide__point-label">{h.label}</div>
              <div className="guide__point-text">{h.text}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="sheet__section">
        <div className="field__label">出来のつけ方</div>
        <p className="text-sub" style={{ fontSize: 12.5, lineHeight: 1.6 }}>{def.scoring}</p>
        <div className="field__label" style={{ marginTop: 10 }}>身につくもの</div>
        <p className="text-sub" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
          <strong>{skill.name}</strong>が伸びます。{skill.effect}。{skill.why}
        </p>
        <div className="field__label" style={{ marginTop: 10 }}>手に入るもの</div>
        <p className="text-sub" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
          出来に応じて<strong>{RESOURCE_MAP[def.reward].name}</strong>が入ります（満点で {formatQty(def.reward, def.rewardMax * rewardMultiplier(st.level), mode)}）。
          {def.bonus && def.bonusMax ? `出来が ${Math.round(BONUS_SCORE * 100)}% を超えると、${RESOURCE_MAP[def.bonus].name}も出ます。` : ''}
          腕が上がるほど、同じ出来でも多く持ち帰れます。
        </p>
        <p className="text-dim" style={{ fontSize: 11.5, marginTop: 6, lineHeight: 1.6 }}>
          腕は下がりません。遊ばなくても先には進めます。
        </p>
      </div>
      <div className="card__actions">
        <Button variant="primary" block onClick={() => setHowto(false)}>
          やってみる
        </Button>
      </div>
    </>
  );

  const body = () => {
    if (howto) return howtoBody();
    if (result) {
      const { score, r } = result;
      return (
        <>
          <div className="sheet__section">
            <div className="stat-grid stat-grid--3">
              <Stat label="出来" value={formatPercent(score, 0)} size="lg" tone={score > 0.8 ? 'profit' : score > 0.5 ? 'default' : 'loss'} />
              <Stat label={skill.name} value={`Lv.${r.level}`} tone="research" extra={r.levelUp > 0 ? `+${r.levelUp}` : undefined} />
              <Stat label="手に入った" value={formatQty(def.reward, r.gained, mode)} extra={RESOURCE_MAP[def.reward].name} tone={r.gained > 0 ? 'profit' : 'default'} />
            </div>
            {r.bonus && (
              <div className="mg__bonus">
                <strong>
                  {RESOURCE_MAP[r.bonus.id].name} {formatQty(r.bonus.id, r.bonus.amount, mode)}
                </strong>
                <span className="text-sub"> も出ました（出来が良かったときだけ）</span>
              </div>
            )}
            {r.levelUp > 0 && (
              <div className="mg__levelup">
                <strong>
                  {skill.name}が Lv.{r.level} に上がりました。
                </strong>
                <div className="text-sub" style={{ fontSize: 12, marginTop: 4 }}>{skill.effect}</div>
              </div>
            )}
            {r.best && r.levelUp === 0 && <div className="text-profit" style={{ fontSize: 12.5, marginTop: 8 }}>自己最高を更新しました。</div>}
            {score < 0.4 && r.levelUp === 0 && (
              <div className="text-sub" style={{ fontSize: 12, marginTop: 8, lineHeight: 1.6 }}>こつ: {def.hint}</div>
            )}
            {!capped && (
              <div style={{ marginTop: 10 }}>
                <ProgressBar ratio={skillProgress(state, def.skill)} tone="accent" label="次のレベルまで" />
                <div className="text-dim num" style={{ fontSize: 11, marginTop: 4 }}>
                  {Math.floor(st.exp)} / {expToNext(st.level)}　（遊んだ回数 {st.plays}）
                </div>
              </div>
            )}
            {capped && <div className="text-sub" style={{ fontSize: 12.5, marginTop: 10 }}>この腕はもう極めています（Lv.{skill.maxLevel}）。</div>}
          </div>
          <div className="card__actions">
            <Button
              variant="primary"
              block
              onClick={() => {
                setResult(null);
                setRound((n) => n + 1);
              }}
            >
              もう一度
            </Button>
          </div>
        </>
      );
    }
    switch (gameId) {
      case 'timing':
        return <TimingGame key={round} onDone={finish} />;
      case 'sort':
        return <SortGame key={round} onDone={finish} />;
      case 'grow':
        return <GrowGame key={round} onDone={finish} />;
      case 'dig':
        return <DigGame key={round} onDone={finish} />;
      default:
        return null;
    }
  };

  return (
    <Sheet open onClose={onClose} title={def.name} icon={<Icon name={def.icon} size={32} fallback={def.name.slice(0, 2)} />}>
      {!howto && !result && (
        <div className="sheet__section">
          <p className="text-dim" style={{ fontSize: 11.5, lineHeight: 1.6 }}>{def.hint}</p>
        </div>
      )}
      {body()}
      {!howto && (
        <button type="button" className="guide__off" onClick={() => setHowto(true)}>
          やり方をもう一度見る
        </button>
      )}
    </Sheet>
  );
}
