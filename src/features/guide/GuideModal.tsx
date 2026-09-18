import { useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { GUIDE_MAP, nextGuide, type GuideDef } from '@/game/data/guides';
import { bumpGame, useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';

/**
 * 使い方ガイド。
 *
 * その画面を初めて開いたときに1回だけ出て、読んだら二度と出ない。
 * 操作は求めない（買わせない・作らせない）。設定からいつでも読み返せる。
 */
export function GuideModal() {
  const { state, derived, engine } = useGame();
  const tab = useUiStore((s) => s.tab);
  const homeSub = useUiStore((s) => s.homeSubTab);
  const mapSub = useUiStore((s) => s.mapSubTab);
  // 設定から開いた読み返し（こちらが優先）
  const openId = useUiStore((s) => s.openGuideId);
  const setOpenGuide = useUiStore((s) => s.setOpenGuide);
  // 「おかえりなさい」と重ならないようにする
  const offline = useUiStore((s) => s.offlineReport);

  const auto = offline ? null : nextGuide({ state, derived, tab, homeSub, mapSub });
  const manual: GuideDef | null = openId ? (GUIDE_MAP[openId] ?? null) : null;
  const guide = manual ?? auto;

  const close = useCallback(() => {
    if (manual) {
      setOpenGuide(null);
      return;
    }
    if (!auto) return;
    // 自動で出たものは、閉じた時点で「読んだ」にする（同じ画面で出続けないように）
    const seen = state.settings.guidesSeen ?? [];
    if (!seen.includes(auto.id)) engine.updateSettings({ guidesSeen: [...seen, auto.id] });
    bumpGame();
  }, [auto, manual, setOpenGuide, state.settings.guidesSeen, engine]);

  const stopAll = useCallback(() => {
    const seen = state.settings.guidesSeen ?? [];
    const add = auto && !seen.includes(auto.id) ? [auto.id] : [];
    engine.updateSettings({ guidesOff: true, guidesSeen: [...seen, ...add] });
    setOpenGuide(null);
    bumpGame();
  }, [auto, setOpenGuide, state.settings.guidesSeen, engine]);

  if (!guide) return null;
  return (
    <Sheet open hideFooter onClose={close} title={guide.title} icon={<Icon name={guide.icon} size={36} fallback={guide.title.slice(0, 2)} />}>
      <div className="sheet__section">
        <div className="guide__badge">使い方</div>
        {guide.body.map((p, i) => (
          <p key={i} className="guide__p">
            {p}
          </p>
        ))}
      </div>
      <div className="sheet__section">
        <div className="guide__points">
          {guide.points.map((pt) => (
            <div key={pt.label} className="guide__point">
              <div className="guide__point-label">{pt.label}</div>
              <div className="guide__point-text">{pt.text}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="sheet__section">
        <Button variant="primary" block onClick={close}>
          わかった
        </Button>
        {!manual && (
          <button className="guide__off" onClick={stopAll}>
            今後この案内を出さない
          </button>
        )}
        <p className="text-dim" style={{ fontSize: 11.5, marginTop: 6, textAlign: 'center' }}>
          設定の「使い方ガイド」からいつでも読み返せます。
        </p>
      </div>
    </Sheet>
  );
}
