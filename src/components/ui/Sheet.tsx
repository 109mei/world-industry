import { useEffect, type ReactNode } from 'react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  /** 下の「閉じる」を出さない（自前で閉じるボタンを置く画面用） */
  hideFooter?: boolean;
}

/**
 * いま開いているシートの枚数。
 *
 * 「開いたときの値を覚えて、閉じるときに戻す」方式は入れ子に耐えない。
 * A→B の順に開き、A から先に片付くと、A が空文字に戻したあと
 * B が 'hidden' に戻してしまい、ページが固定されたままになる。
 * （シートを開いたまま20秒以上離れると「おかえりなさい」が重なるので、実際に起きうる）
 * 枚数で数えて、0枚になったときだけ戻す。
 */
let openSheets = 0;

/** 下から出てくる詳細パネル（PC では中央のダイアログ） */
export function Sheet({ open, onClose, title, icon, children, hideFooter = false }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    openSheets += 1;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      openSheets = Math.max(0, openSheets - 1);
      if (openSheets === 0) document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__handle" />
        <div className="sheet__head">
          {icon}
          <div className="sheet__title">{title}</div>
          <button className="sheet__close" onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </div>
        {children}
        {!hideFooter && (
          <div className="sheet__footer">
            <button className="btn btn--secondary btn--block" onClick={onClose} aria-label="閉じる">
              閉じる
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
