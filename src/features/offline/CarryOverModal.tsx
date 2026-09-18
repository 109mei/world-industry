import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { bumpGame, useGame } from '@/stores/gameStore';
import { formatMoney } from '@/utils/format';

/**
 * 前の版から引き継いだお知らせ。一度だけ出す。
 *
 * 素材の値段をすべて現実の相場に置き換えたとき、「1個」が指す量そのものが変わった
 * （1個＝1kg／1g／1L）。同じ「鉄100」が別の量を意味してしまうので、
 * セーブはそのまま読まずに作り直している。
 * ただし遊んだぶんを消してしまうのは忍びないので、持っていたもの全部を
 * 新しい相場で数え直して、まとめて所持金にしてある。
 */
export function CarryOverModal() {
  const { state } = useGame();
  const amount = state.meta.carriedOver ?? 0;
  if (amount <= 0 || state.meta.carriedOverSeen) return null;
  const mode = state.settings.numberFormat;

  const close = () => {
    state.meta.carriedOverSeen = true;
    bumpGame();
  };

  return (
    <Sheet open onClose={close} title="前の会社を引き継ぎました" icon={<Icon name="icon_office_coins" size={36} fallback="¥" />}>
      <p style={{ fontSize: 13, marginTop: 6, lineHeight: 1.7 }}>
        素材の値段を、すべて<strong>現実の相場</strong>に置き換えました。
        それにともなって「1個」が指す量そのものが変わっています（素材は1kg、水や燃料は1L、金と銀は1g）。
        同じ在庫の数字が前と違う量を意味してしまうため、会社は新しく建て直しています。
      </p>
      <div className="sheet__section" style={{ textAlign: 'center' }}>
        <div className="field__label">前の会社で持っていたもの全部を、新しい相場で数え直した額</div>
        <div className="carryover__amount num text-profit" style={{ marginTop: 4 }}>
          {formatMoney(amount, mode)}
        </div>
        <div className="text-sub" style={{ fontSize: 12, marginTop: 6 }}>
          所持金・在庫・施設・土地を合わせた額です。まるごと開業資金として持ち越してあります。
        </div>
      </div>
      <p className="text-sub" style={{ fontSize: 12.5, marginTop: 8, lineHeight: 1.6 }}>
        実績と永続ポイントはそのまま残っています。
      </p>
      <div className="card__actions">
        <Button variant="primary" block onClick={close}>
          はじめる
        </Button>
      </div>
    </Sheet>
  );
}
