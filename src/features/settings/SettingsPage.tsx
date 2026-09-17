import { Card } from '@/components/ui/Card';
import { GAME_META } from '@/game/data/meta';
import { SettingsPanel } from '@/features/company/SettingsPanel';

/** 設定 */
export function SettingsPage() {
  return (
    <div className="page">
      <h1 className="page__title">
        設定<small>表示・音・セーブデータ</small>
      </h1>
      <Card>
        <SettingsPanel />
      </Card>
      <p className="text-dim" style={{ fontSize: 12, textAlign: 'center' }}>
        {GAME_META.title} v{GAME_META.version}
      </p>
    </div>
  );
}
