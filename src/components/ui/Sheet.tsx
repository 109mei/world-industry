import { useEffect, type ReactNode } from 'react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
}

/** 下から出てくる詳細パネル（PC では中央のダイアログ） */
export function Sheet({ open, onClose, title, icon, children }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
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
        <div className="sheet__footer">
          <button className="btn btn--secondary btn--block" onClick={onClose} aria-label="閉じる">
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
