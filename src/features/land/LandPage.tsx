import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Stat } from '@/components/ui/Stat';
import { CONFIG } from '@/game/data/config';
import { useGame } from '@/stores/gameStore';
import { formatMoney } from '@/utils/format';

const PLANNED = [
  { icon: 'icon_ui_land', title: '世界地図', text: '日本・アメリカ・中国・オーストラリアなどの土地を購入。人口・交通量・資源で価格が変わる。' },
  { icon: 'icon_marker_survey', title: '地下資源調査', text: '未調査 → 簡易調査 → 地質調査 → 試掘 → 確定。鉱床は有限で、掘り尽くすと枯渇する。' },
  { icon: 'icon_facility_iron_mine', title: '鉱山・農園', text: '土地の条件に合わせて鉱山・油田・農園を建設。ゴムは高温多湿、小麦は広い農地で高効率。' },
  { icon: 'icon_ui_power', title: '電力', text: '火力・太陽光・風力・水力・原子力。電力が足りないと工場の効率が下がる。' },
  { icon: 'icon_ui_logistics', title: '物流', text: 'トラック・鉄道・船・航空・パイプラインで土地間に資源を運ぶ。' },
  { icon: 'icon_commercial_parking', title: '商業施設', text: '駐車場・店舗・オフィス・データセンター。交通量と人口で収益が決まる。' },
];

export function LandPage() {
  const { state, derived } = useGame();
  const mode = state.settings.numberFormat;
  const target = CONFIG.landUnlockAssets;
  const ratio = derived.assets / target;
  return (
    <div className="page">
      <h1 className="page__title">
        土地<small>世界展開はこれから</small>
      </h1>
      <Card>
        <div className="card__head">
          <Icon name="icon_ui_lock" size={36} fallback="LK" />
          <div className="row__grow">
            <div className="card__title">土地システムは未解放</div>
            <div className="card__sub">総資産が {formatMoney(target, 'full')} に達すると解放されます。</div>
          </div>
        </div>
        <div className="card__body">
          <div className="stat-grid" style={{ marginBottom: 8 }}>
            <Stat label="現在の総資産" value={formatMoney(derived.assets, mode)} />
            <Stat label="必要な資産" value={formatMoney(target, mode)} />
          </div>
          <ProgressBar ratio={ratio} tone="research" size="lg" />
          <div className="text-sub num" style={{ fontSize: 12, marginTop: 4 }}>
            {Math.min(100, ratio * 100).toFixed(1)}%
          </div>
        </div>
      </Card>
      <div className="section-title">今後追加される内容</div>
      <div className="grid grid--2">
        {PLANNED.map((p) => (
          <Card key={p.title} flat>
            <div className="card__head">
              <Icon name={p.icon} size={32} fallback={p.title.slice(0, 2)} />
              <div className="row__grow">
                <div className="card__title">{p.title}</div>
                <div className="card__sub">{p.text}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <p className="text-dim" style={{ fontSize: 12 }}>
        土地データは実在地域を参考にしたゲーム用の値になる予定です。現実の数値そのものではありません。
      </p>
    </div>
  );
}
