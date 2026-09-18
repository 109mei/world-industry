import { useCallback, useMemo, useRef, useState } from 'react';
import { sfx } from '@/utils/sfx';
import { useFrameLoop, useTimeouts } from './useFrameLoop';

/**
 * 「廃品を仕分ける」。流れてくる廃品を、鉄・銅・ごみに分ける。
 *
 * 現実の選別とおなじで、見分けの手がかりは形と素材。
 * 板と棒は鉄、線と管は銅、それ以外はごみ、という筋を通してある。
 * 覚えれば速くなるので、回を重ねるほど自分が上手くなる作りになる。
 */

type Bin = 'iron' | 'copper' | 'trash';

const BIN_LABEL: Record<Bin, string> = { iron: '鉄', copper: '銅', trash: 'ごみ' };

const ITEMS: { name: string; bin: Bin }[] = [
  { name: '鉄板の切れ端', bin: 'iron' },
  { name: '曲がった鉄筋', bin: 'iron' },
  { name: 'ボルトとナット', bin: 'iron' },
  { name: '折れた鉄パイプ', bin: 'iron' },
  { name: 'スチール缶', bin: 'iron' },
  { name: '鋼材の端材', bin: 'iron' },
  { name: '被覆電線', bin: 'copper' },
  { name: '銅管の切れ端', bin: 'copper' },
  { name: 'モーターのコイル', bin: 'copper' },
  { name: '端子のかたまり', bin: 'copper' },
  { name: '銅線のくず', bin: 'copper' },
  { name: '割れたガラス', bin: 'trash' },
  { name: '濡れた木片', bin: 'trash' },
  { name: 'ビニール袋', bin: 'trash' },
  { name: '汚れた布きれ', bin: 'trash' },
  { name: '紙くずの束', bin: 'trash' },
];

const COUNT = 12;
/** 1個あたりの持ち時間（秒）。急かしすぎない程度 */
const PER_ITEM_SEC = 2.6;

interface Props {
  onDone: (score: number) => void;
}

function shuffled<T>(list: readonly T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function SortGame({ onDone }: Props) {
  const queue = useMemo(() => {
    // 3種がかたよらないように、それぞれから拾ってから混ぜる
    const pick = (bin: Bin, n: number) => shuffled(ITEMS.filter((i) => i.bin === bin)).slice(0, n);
    return shuffled([...pick('iron', 5), ...pick('copper', 4), ...pick('trash', 3)]).slice(0, COUNT);
  }, []);
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [flash, setFlash] = useState<'ok' | 'ng' | ''>('');
  const [locked, setLocked] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const later = useTimeouts();
  /** この品を出してからの経過。時間切れの判定と、バーの描き換えに使う */
  const overRef = useRef(false);

  const item = queue[index];

  const answer = useCallback(
    (bin: Bin | null) => {
      // 二重押しは ref で同期的に弾く（state の反映を待たない）
      if (locked || overRef.current || !item) return;
      overRef.current = true;
      const ok = bin === item.bin;
      setLocked(true);
      setFlash(ok ? 'ok' : 'ng');
      sfx(ok ? 'tap' : 'warn');
      const nextCorrect = correct + (ok ? 1 : 0);
      setCorrect(nextCorrect);
      later(() => {
        setFlash('');
        setLocked(false);
        if (index + 1 >= queue.length) onDone(nextCorrect / queue.length);
        else {
          overRef.current = false;
          setIndex(index + 1);
        }
      }, 260);
    },
    [locked, item, correct, index, queue.length, onDone, later],
  );

  // 持ち時間のバーは自分で書き換える。CSS のアニメーションに任せると
  // 「動きを減らす」設定のときに一瞬で切れて、遊べなくなってしまう。
  useFrameLoop(
    (elapsed) => {
      if (overRef.current) return;
      const left = Math.max(0, 1 - elapsed / PER_ITEM_SEC);
      const el = barRef.current;
      if (el) el.style.width = `${(left * 100).toFixed(1)}%`;
      if (left <= 0) answer(null);
    },
    !locked,
  );

  if (!item) return null;

  return (
    <div className="mg">
      <div className="mg__head">
        <span className="mg__round">{index + 1} / {queue.length} 個目</span>
        <span className="mg__note">正しく分けた {correct}</span>
      </div>

      <div className={`mg__item${flash ? ` mg__item--${flash}` : ''}`}>
        {/* 持ち時間のバー。切れたら「ごみ箱に落ちた」＝はずれ扱い */}
        <div key={index} className="mg__timer" ref={barRef} style={{ width: '100%' }} />
        <div className="mg__item-name">{item.name}</div>
      </div>

      <div className="mg__bins">
        {(['iron', 'copper', 'trash'] as Bin[]).map((b) => (
          <button key={b} type="button" className={`btn btn--secondary mg__bin mg__bin--${b}`} onClick={() => answer(b)} disabled={locked}>
            {BIN_LABEL[b]}
          </button>
        ))}
      </div>
      <div className="text-dim mg__foot">板と棒は鉄、線と管は銅、それ以外はごみ。</div>
    </div>
  );
}
