import { useEffect } from 'react';
import { useUiStore } from '@/stores/uiStore';

export function Toasts() {
  const toasts = useUiStore((s) => s.toasts);
  const dismiss = useUiStore((s) => s.dismissToast);

  useEffect(() => {
    if (toasts.length === 0) return;
    const first = toasts[0];
    const t = setTimeout(() => dismiss(first.id), 2600);
    return () => clearTimeout(t);
  }, [toasts, dismiss]);

  if (toasts.length === 0) return null;
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.type}`} onClick={() => dismiss(t.id)}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
