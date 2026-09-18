import type { Bookmark } from '@/types/state';
import { bumpGame, useGame } from '@/stores/gameStore';
import { sfx } from '@/utils/sfx';

/**
 * 気になる場所に印（★）を付けるボタン。
 * 付けたものは地図の「気になる」からいつでも呼び出せる。
 */
export function BookmarkButton({ entry, block = false }: { entry: Omit<Bookmark, 'at'>; block?: boolean }) {
  const { engine } = useGame();
  const on = engine.hasBookmark(entry.kind, entry.id);
  return (
    <button
      type="button"
      className={`bookmark${on ? ' bookmark--on' : ''}${block ? ' bookmark--block' : ''}`}
      aria-pressed={on}
      title={on ? '印を外す' : 'あとで見るために印を付ける'}
      onClick={(e) => {
        e.stopPropagation();
        engine.toggleBookmark(entry);
        sfx('tap');
        bumpGame();
      }}
    >
      <span aria-hidden="true">{on ? '★' : '☆'}</span>
      <span>{on ? '印あり' : '気になる'}</span>
    </button>
  );
}
