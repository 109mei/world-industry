interface SegmentedProps<T extends string> {
  items: { id: T; label: string; badge?: number }[];
  value: T;
  onChange: (id: T) => void;
  ariaLabel?: string;
}

export function Segmented<T extends string>({ items, value, onChange, ariaLabel }: SegmentedProps<T>) {
  return (
    <div className="segmented" role="tablist" aria-label={ariaLabel}>
      {items.map((it) => (
        <button key={it.id} role="tab" aria-selected={it.id === value} className="segmented__item" onClick={() => onChange(it.id)}>
          {it.label}
          {it.badge !== undefined && it.badge > 0 && <span className="badge badge--power" style={{ marginLeft: 6 }}>{it.badge}</span>}
        </button>
      ))}
    </div>
  );
}
