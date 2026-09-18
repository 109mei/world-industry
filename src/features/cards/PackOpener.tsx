import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { CARD_MAP, RARITY_MAP, betterRarity, type PackDef } from '@/game/data/cards';
import type { PullResult } from '@/game/engine/systems/cards';
import { sfx } from '@/utils/sfx';
import { CardFace } from './CardFace';

/** パックを開ける画面。1枚ずつめくれていく */
export function PackOpener({ pack, canBuy, onOpen }: { pack: PackDef; canBuy: boolean; onOpen: () => PullResult }) {
  const [pull, setPull] = useState<PullResult | null>(null);
  const [shown, setShown] = useState(0);
  const [message, setMessage] = useState('');
  const timers = useRef<number[]>([]);

  const clear = () => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  };
  useEffect(() => clear, []);

  const open = useCallback(() => {
    clear();
    const r = onOpen();
    if (!r.ok) {
      setMessage(r.reason ?? '');
      return;
    }
    setMessage('');
    setPull(r);
    setShown(0);
    sfx('buy');
    // たくさん開けたときは、全部めくるのに時間がかかりすぎるので上位だけ演出する
    const reveal = Math.min(r.cards.length, 10);
    for (let i = 1; i <= reveal; i++) {
      timers.current.push(
        window.setTimeout(() => {
          setShown(i);
          const c = CARD_MAP[r.cards[i - 1]];
          if (c && betterRarity(c.rarity, 'sr')) sfx('sell');
          else sfx('tap');
        }, i * 260),
      );
    }
    if (r.cards.length > reveal) {
      timers.current.push(window.setTimeout(() => setShown(r.cards.length), reveal * 260 + 300));
    }
  }, [onOpen]);

  const visible = pull ? pull.cards.slice(0, shown) : [];
  const rest = pull ? pull.cards.length - visible.length : 0;

  return (
    <div className="packer">
      <div className={`packer__tray${pull ? ' packer__tray--open' : ''}`}>
        {visible.length === 0 ? (
          <div className="packer__closed">
            <span className="text-dim" style={{ fontSize: 12 }}>{pack.note}</span>
          </div>
        ) : (
          <div className="packer__cards">
            {visible.map((id, i) => (
              <div key={`${id}-${i}`} className="packer__slot">
                <CardFace id={id} size="md" />
              </div>
            ))}
            {rest > 0 && <div className="packer__rest num">ほか {rest}枚</div>}
          </div>
        )}
      </div>

      {pull && shown >= Math.min(pull.cards.length, 10) && (
        <div className="packer__summary">
          <span className={pull.value >= pull.cost ? 'text-profit' : 'text-sub'}>
            いちばん良かったのは {RARITY_MAP[pull.best].name}・出たものの値打ち {Math.round(pull.value).toLocaleString('ja-JP')}円
            （{Math.round(pull.cost).toLocaleString('ja-JP')}円ぶん）
          </span>
        </div>
      )}

      <Button block variant={canBuy ? 'primary' : 'secondary'} disabled={!canBuy} onClick={open}>
        {pack.cost.toLocaleString('ja-JP')}円で開ける
      </Button>
      {message && (
        <div className="text-sub" style={{ fontSize: 12, marginTop: 4 }}>
          {message}
        </div>
      )}
    </div>
  );
}
