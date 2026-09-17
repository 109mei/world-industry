import { Button } from '@/components/ui/Button';
import type { Diagnosis } from '@/game/engine/analysis/diagnose';
import { useGame } from '@/stores/gameStore';
import { runAction } from '@/features/common/runAction';

/** 施設が止まっている理由と「直す」ボタン */
export function FixPanel({ diagnosis }: { diagnosis: Diagnosis }) {
  const { engine } = useGame();
  return (
    <div className="fix" role="status">
      <div className="fix__reason">
        <span className="fix__mark" aria-hidden="true">!</span>
        {diagnosis.reason}
      </div>
      {diagnosis.fixes.length > 0 && (
        <div className="btn-row" style={{ marginTop: 6 }}>
          {diagnosis.fixes.slice(0, 3).map((f, i) => (
            <Button key={i} size="sm" variant={i === 0 ? 'primary' : 'secondary'} disabled={!f.enabled} onClick={() => runAction(engine, f.action)}>
              {f.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
