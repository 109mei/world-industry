import { memo } from 'react';
import { CARD_MAP, RARITY_MAP } from '@/game/data/cards';
import { cardArtUrl } from '@/utils/assets';

const ART_PX = { sm: 62, md: 84, lg: 116 } as const;

/** カード1枚の見た目。レア度で枠と光り方が変わる */
function CardFaceBase({ id, size = 'md', count, faded }: { id: string; size?: 'sm' | 'md' | 'lg'; count?: number; faded?: boolean }) {
  const def = CARD_MAP[id];
  if (!def) return null;
  const r = RARITY_MAP[def.rarity];
  const w = ART_PX[size];
  return (
    <div
      className={`tcard tcard--${size} tcard--${def.rarity}${faded ? ' tcard--faded' : ''}`}
      title={`No.${def.no} ${def.name}（${r.name}）\n${def.flavor}`}
    >
      <div className="tcard__top">
        <span className={`tcard__rarity tcard__rarity--${def.rarity}`}>{r.short}</span>
        {count !== undefined && count > 1 && <span className="tcard__count num">×{count}</span>}
      </div>
      <div className="tcard__art">
        {/* 絵は横長（168×118）。幅いっぱいに置いて、高さは比率から決める */}
        <img
          src={cardArtUrl(def.art, 'webp')}
          alt={def.name}
          width={w}
          height={Math.round((w * 118) / 168)}
          loading="lazy"
          decoding="async"
          draggable={false}
        />
      </div>
      <div className="tcard__name">{def.name}</div>
    </div>
  );
}

/**
 * 同じ内容なら描き直さない。
 * 一覧にたくさん並ぶ部品なので、毎回の画面更新でここまで作り直さないようにしている。
 */
export const CardFace = memo(CardFaceBase);
