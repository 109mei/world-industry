import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { FACILITY_MAP, facilityCost } from '@/game/data/facilities';
import { isLandSystemUnlocked, isUnlocked } from '@/game/engine/systems/unlocks';
import { useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatMoney } from '@/utils/format';

/**
 * 研究ポイントが1つも入っていない人への道案内。
 *
 * 研究ツリーは「土地を買う → そこに研究所を建てる」まで進まないと1ミリも動かない。
 * それを知らないまま研究の画面を開くと、ただ灰色の図が出るだけで詰まってしまうので、
 * いまどこで止まっているのかと、次に押す場所をそのまま出す。
 */
export function ResearchLabHint() {
  const { state, derived } = useGame();
  const setTab = useUiStore((s) => s.setTab);
  const setMapSubTab = useUiStore((s) => s.setMapSubTab);
  const setFactoryLand = useUiStore((s) => s.setFactoryLand);

  const labs = state.facilities.filter((f) => f.typeId === 'research_lab').reduce((a, f) => a + f.count, 0);
  // すでにポイントが入っているなら、案内は要らない
  if (derived.researchRate > 0 || labs > 0) return null;

  const mode = state.settings.numberFormat;
  const lands = state.lands.filter((l) => l.id !== 'hq');
  const landSystem = isLandSystemUnlocked(state, derived.assets);
  const labUnlocked = isUnlocked(state, 'facility', 'research_lab');
  const def = FACILITY_MAP.research_lab;
  const need = def.unlock && def.unlock.type === 'assets' ? def.unlock.min : 0;
  const cost = facilityCost(def, 0);

  // いまどこで止まっているか
  const step = !landSystem ? 'assets_land' : lands.length === 0 ? 'buy_land' : !labUnlocked ? 'assets_lab' : 'build';

  const head =
    step === 'build'
      ? '研究所を建てると、研究が動き出します'
      : step === 'assets_lab'
        ? 'あと少しで研究所が建てられます'
        : step === 'buy_land'
          ? 'まず土地を買ってください'
          : '研究はもう少し先です';

  return (
    <Card>
      <div className="card__head">
        <Icon name="icon_ui_research" size={34} fallback="研究" />
        <div className="row__grow">
          <div className="card__title">{head}</div>
          <div className="card__sub">研究ポイント（RP）は自然には増えません。土地に建てた<strong>研究所</strong>だけが生み出します。</div>
        </div>
      </div>
      <div className="card__body">
        <ol className="labhint">
          <li className={step === 'assets_land' || step === 'buy_land' ? 'labhint--now' : 'labhint--done'}>
            <span className="labhint__n">1</span>
            <span>
              <strong>地図で土地を買う</strong>
              <span className="labhint__sub">研究所は本社には建てられません。地図タブから土地か建物を買います。</span>
            </span>
          </li>
          <li className={step === 'assets_lab' ? 'labhint--now' : step === 'build' ? 'labhint--done' : ''}>
            <span className="labhint__n">2</span>
            <span>
              <strong>研究所を解放する</strong>
              <span className="labhint__sub">総資産が {formatMoney(need, 'full')} になると、施設の一覧に研究所が出ます。</span>
            </span>
          </li>
          <li className={step === 'build' ? 'labhint--now' : ''}>
            <span className="labhint__n">3</span>
            <span>
              <strong>その土地に研究所を建てる</strong>
              <span className="labhint__sub">
                施設タブで土地を選んでから建てます（{formatMoney(cost, mode)}・1棟で {def.researchRate ?? 0} RP/秒）。
              </span>
            </span>
          </li>
        </ol>

        {step === 'assets_lab' && (
          <div style={{ marginTop: 8 }}>
            <ProgressBar ratio={derived.assets / Math.max(1, need)} tone="research" size="lg" />
            <div className="text-sub num" style={{ fontSize: 12, marginTop: 4 }}>
              総資産 {formatMoney(derived.assets, mode)} / {formatMoney(need, mode)}
            </div>
          </div>
        )}
        {step === 'assets_land' && (
          <div className="text-sub" style={{ fontSize: 12, marginTop: 8, lineHeight: 1.6 }}>
            まず地図が使えるようになるまで、手元の商売で総資産を増やしてください。地図タブに必要な額と今の進み具合が出ています。
          </div>
        )}

        <div className="btn-row" style={{ marginTop: 10 }}>
          {step === 'build' ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                const first = lands[0];
                if (first) setFactoryLand(first.id);
                setTab('factory');
              }}
            >
              施設を建てに行く
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setMapSubTab('map');
                setTab('map');
              }}
            >
              地図を見に行く
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
