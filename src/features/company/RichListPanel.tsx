import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Stat } from '@/components/ui/Stat';
import { entryLine, myRank, nextTarget, ranking } from '@/game/engine/systems/richList';
import { useGame } from '@/stores/gameStore';
import { formatMoney, formatNumber } from '@/utils/format';

/** 長者番付。架空の富豪一覧に自分が何位で載るか */
export function RichListPanel() {
  const { state, derived } = useGame();
  const mode = state.settings.numberFormat;
  const assets = derived.assets;
  const all = ranking(state, assets, state.company.name);
  const rank = myRank(state, assets);
  const line = entryLine(state);
  const target = nextTarget(state, assets);
  const listed = assets >= line;
  // 上位20人と、自分の前後
  const meIndex = all.findIndex((p) => p.isPlayer);
  const near = all.slice(Math.max(0, meIndex - 3), meIndex + 4);
  const top = all.slice(0, 20);
  const shown = new Set(top.map((p) => p.rank));

  return (
    <div className="list">
      <Card>
        <div className="stat-grid stat-grid--4">
          <Stat label="あなたの順位" value={listed ? `${formatNumber(rank, 'full')}位` : '圏外'} size="lg" tone={rank <= 10 ? 'profit' : 'research'} />
          <Stat label="総資産" value={formatMoney(assets, mode)} />
          <Stat label="載るための目安" value={formatMoney(line, mode)} extra={listed ? '達成' : 'あと少し'} />
          <Stat label="番付の人数" value={`${all.length - 1}人`} />
        </div>
        {target && (
          <div style={{ marginTop: 8 }}>
            <ProgressBar ratio={Math.min(1, assets / target.worth)} tone="profit" label={`次は ${target.name}（${target.company}）を抜く`} />
            <div className="text-sub num" style={{ fontSize: 12, marginTop: 4 }}>
              あと {formatMoney(Math.max(0, target.worth - assets), mode)}
            </div>
          </div>
        )}
        <p className="text-dim" style={{ fontSize: 12, marginTop: 8 }}>
          並んでいるのは架空の富豪で、実在の人物・企業とは関係がありません。彼らの資産も少しずつ増えていくので、止まっていると抜かれていきます。
        </p>
      </Card>

      <div className="section-title">上位20人</div>
      <Card>
        <div className="list" style={{ gap: 2 }}>
          {top.map((p) => (
            <Row key={`${p.rank}:${p.name}`} p={p} mode={mode} />
          ))}
        </div>
      </Card>

      {!shown.has(rank) && (
        <>
          <div className="section-title">あなたのまわり</div>
          <Card>
            <div className="list" style={{ gap: 2 }}>
              {near.map((p) => (
                <Row key={`${p.rank}:${p.name}`} p={p} mode={mode} />
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function Row({ p, mode }: { p: ReturnType<typeof ranking>[number]; mode: 'short' | 'full' }) {
  return (
    <div className={`row row--between${p.isPlayer ? ' text-research' : ''}`} style={{ fontSize: 13, padding: '3px 0', fontWeight: p.isPlayer ? 700 : 400 }}>
      <span className="num" style={{ minWidth: 38, opacity: 0.7 }}>
        {p.rank}位
      </span>
      <span className="row__grow" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {p.isPlayer && <Icon name="icon_ui_star" size={16} />} {p.name}
        <span className="text-sub" style={{ fontSize: 11, marginLeft: 6 }}>
          {p.company}
          {p.country !== '—' ? `・${p.country}` : ''}
        </span>
      </span>
      <span className="num">{formatMoney(p.worth, mode)}</span>
      {p.rank <= 3 && !p.isPlayer && <Badge tone="profit">上位</Badge>}
    </div>
  );
}
