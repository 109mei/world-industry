import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';

/**
 * 「ホーム画面に追加」。
 * 追加すると、アドレスバーの無い1枚の画面で遊べて、次からアイコンから開ける。
 */
export function InstallCard({ compact = false }: { compact?: boolean }) {
  const { canInstall, needsManual, installed, install } = useInstallPrompt();
  if (installed) return null;
  if (!canInstall && !needsManual) return null;

  const body = (
    <>
      <div className="card__head">
        <Icon name="icon_ui_upgrade" size={32} fallback="追加" />
        <div className="row__grow">
          <div className="card__title">ホーム画面に追加する</div>
          <div className="card__sub">アプリのように、アイコンから1枚の画面で開けるようになります。通信は要りません。</div>
        </div>
      </div>
      <div className="card__body">
        {canInstall ? (
          <Button variant="primary" block onClick={() => void install()}>
            ホーム画面に追加
          </Button>
        ) : (
          <div className="text-sub" style={{ fontSize: 12.5, lineHeight: 1.7 }}>
            iPhone・iPad では、下の<strong>共有ボタン（□に↑）</strong>を押して、
            メニューの<strong>「ホーム画面に追加」</strong>を選んでください。
          </div>
        )}
      </div>
    </>
  );

  if (compact) return <Card flat>{body}</Card>;
  return <Card>{body}</Card>;
}
