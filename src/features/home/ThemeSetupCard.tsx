import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import type { ThemeMode } from '@/types/state';
import { bumpGame, useGame } from '@/stores/gameStore';
import { applyTheme, resolveTheme } from '@/utils/theme';

/** 見本に出す配色。tokens.css の値と同じものを、見本の中だけで使う */
const SAMPLE = {
  dark: { bg: '#0E1116', card: '#171C24', text: '#F2F4F7', sub: '#9DA7B5', accent: '#5EA7FF', profit: '#61C987', border: '#34404F' },
  light: { bg: '#F3F5F8', card: '#FFFFFF', text: '#16202B', sub: '#55647A', accent: '#2B7BD6', profit: '#1F9D55', border: '#C3CCD8' },
} as const;

/** 選べる配色。端末の設定に合わせる場合は、いまの端末の見た目で見本を出す */
function Sample({ mode, on }: { mode: 'dark' | 'light'; on: boolean }) {
  const c = SAMPLE[mode];
  return (
    <div className="themepick__sample" style={{ background: c.bg, borderColor: on ? c.accent : c.border }}>
      <div className="themepick__bar" style={{ background: c.card, borderColor: c.border }}>
        <span style={{ color: c.text, fontWeight: 800, fontSize: 9 }}>WORLD INDUSTRY</span>
      </div>
      <div className="themepick__row" style={{ background: c.card, borderColor: c.border }}>
        <span style={{ color: c.sub, fontSize: 9 }}>所持金</span>
        <span style={{ color: c.text, fontWeight: 800, fontSize: 12 }}>128,400円</span>
      </div>
      <div className="themepick__row" style={{ background: c.card, borderColor: c.border }}>
        <span style={{ color: c.sub, fontSize: 9 }}>自動収益</span>
        <span style={{ color: c.profit, fontWeight: 800, fontSize: 12 }}>+240円/秒</span>
      </div>
      <div className="themepick__btn" style={{ background: c.accent, color: mode === 'dark' ? '#08111f' : '#FFFFFF' }}>
        石を拾う
      </div>
    </div>
  );
}

/**
 * いちばん最初に、暗い配色と明るい配色のどちらで遊ぶかを決める。
 *
 * 見本を並べて、押した瞬間に画面全体がその配色に変わるようにしてある
 * （説明を読むより、実物を見たほうが早い）。あとから設定でいつでも変えられる。
 */
export function ThemeSetupCard() {
  const { state, engine } = useGame();
  const [preview, setPreview] = useState<ThemeMode | null>(null);
  if (state.settings.themeChosen) return null;
  const current = preview ?? state.settings.theme ?? 'dark';

  /** 押したらその場で画面に反映する（決定はまだしない） */
  const tryOn = (mode: ThemeMode) => {
    setPreview(mode);
    applyTheme(resolveTheme(mode));
  };

  return (
    <Card>
      <div className="card__head">
        <Icon name="icon_ui_settings" size={36} fallback="色" />
        <div className="row__grow">
          <div className="card__title">まず画面の色を選びます</div>
          <div className="card__sub">押すとその場で見た目が変わります。あとから設定でいつでも変えられます。</div>
        </div>
      </div>
      <div className="card__body">
        <div className="themepick">
          <button type="button" className={`themepick__opt${current === 'dark' ? ' themepick__opt--on' : ''}`} onClick={() => tryOn('dark')}>
            <Sample mode="dark" on={current === 'dark'} />
            <span className="themepick__name">暗い配色</span>
            <span className="themepick__note">暗い部屋や夜に目が疲れにくい</span>
          </button>
          <button type="button" className={`themepick__opt${current === 'light' ? ' themepick__opt--on' : ''}`} onClick={() => tryOn('light')}>
            <Sample mode="light" on={current === 'light'} />
            <span className="themepick__name">明るい配色</span>
            <span className="themepick__note">昼間や屋外でも見やすい</span>
          </button>
        </div>
        <Button
          size="sm"
          variant={current === 'system' ? 'primary' : 'secondary'}
          block
          style={{ marginTop: 8 }}
          onClick={() => tryOn('system')}
        >
          端末の設定に合わせる{current === 'system' ? '（いまこれ）' : ''}
        </Button>
        <Button
          variant="primary"
          block
          style={{ marginTop: 10 }}
          onClick={() => {
            engine.chooseTheme(current);
            bumpGame();
          }}
        >
          この色ではじめる ›
        </Button>
      </div>
    </Card>
  );
}
