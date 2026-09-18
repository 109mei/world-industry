import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { bumpGame, useGame } from '@/stores/gameStore';

/** 名前に迷ったときの候補（押すとそのまま入る） */
const SAMPLES = ['マイカンパニー', '東和産業', '新星工業', 'あさひ商会', 'ノース・トレーディング'];

/**
 * いちばん最初に、自分の会社の名前を決める。
 * 配色を選んだすぐあと、本社を決める前に出す。あとから設定でいつでも変えられる。
 */
export function NameSetupCard() {
  const { state, engine } = useGame();
  const [name, setName] = useState(state.company.name ?? '');
  const [message, setMessage] = useState('');
  if (state.settings.nameChosen) return null;
  const trimmed = name.trim();

  const decide = () => {
    if (!engine.chooseCompanyName(trimmed)) {
      setMessage('会社名を入れてください');
      return;
    }
    bumpGame();
  };

  return (
    <Card>
      <div className="card__head">
        <Icon name="icon_ui_company" size={36} fallback="社" />
        <div className="row__grow">
          <div className="card__title">会社の名前を決めます</div>
          <div className="card__sub">この名前で、取引先や地図に出てきます。あとから設定でいつでも変えられます。</div>
        </div>
      </div>
      <div className="card__body">
        <input
          className="input"
          type="text"
          value={name}
          maxLength={24}
          placeholder="例：東和産業"
          onChange={(e) => {
            setName(e.target.value);
            setMessage('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') decide();
          }}
          style={{ width: '100%' }}
        />
        <div className="cardfilter" style={{ marginTop: 8 }}>
          {SAMPLES.map((s) => (
            <button key={s} type="button" className="cardfilter__btn" onClick={() => setName(s)}>
              {s}
            </button>
          ))}
        </div>
        <div className="text-dim num" style={{ fontSize: 11, marginTop: 4 }}>
          {trimmed.length} / 24文字
        </div>
        <Button variant="primary" block style={{ marginTop: 10 }} disabled={!trimmed} onClick={decide}>
          この名前ではじめる ›
        </Button>
        {message && (
          <div className="text-sub" style={{ fontSize: 12, marginTop: 6 }}>
            {message}
          </div>
        )}
      </div>
    </Card>
  );
}
