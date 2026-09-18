import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { hqLocation } from '@/game/engine/hq';
import { getCustom, customPrice } from '@/game/engine/systems/customEstate';
import { LAND_MAP, isLandDefId } from '@/game/data/lands';
import { getLand } from '@/game/engine/land';
import { bumpGame, useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatMoney } from '@/utils/format';
import { distanceKm, formatDistance } from '@/utils/geo';
import type { Bookmark } from '@/types/state';

const KIND_LABEL: Record<Bookmark['kind'], string> = {
  feature: '地図の建物',
  land: '産業用地',
  property: '物件',
  client: '取引先',
  company: '上場企業',
};

const KIND_ICON: Record<Bookmark['kind'], string> = {
  feature: 'icon_commercial_office',
  land: 'icon_ui_land',
  property: 'icon_commercial_apartment',
  client: 'icon_ui_mail',
  company: 'icon_ui_company',
};

/**
 * 気になる場所の一覧。
 * 買うか迷っている区画、よく見に行く自分の場所、取引先などをここにまとめ、
 * 押せば地図がその場所へ飛ぶ。
 */
export function BookmarkList() {
  const { state, engine } = useGame();
  const flyTo = useUiStore((s) => s.flyTo);
  const setMapSubTab = useUiStore((s) => s.setMapSubTab);
  const mode = state.settings.numberFormat;
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const list = [...(state.bookmarks ?? [])].reverse();
  if (list.length === 0) {
    return (
      <Card>
        <div className="empty">
          まだ印がありません。地図で建物や土地を選んだときに出る<strong>「☆ 気になる」</strong>を押すと、ここに並びます。
        </div>
      </Card>
    );
  }

  const hq = hqLocation(state);

  /** その印の「いまの状態」を短く言う */
  const statusOf = (b: Bookmark): { text: string; tone: 'profit' | 'warn' | 'default' } => {
    if (b.kind === 'feature') {
      const owned = getCustom(state, b.id);
      if (owned) return { text: `所有中・${formatMoney(customPrice(state, owned), mode)}`, tone: 'profit' };
      return { text: '未購入', tone: 'default' };
    }
    if (b.kind === 'land' && isLandDefId(b.id)) {
      const def = LAND_MAP[b.id];
      if (getLand(state, b.id)) return { text: '所有中', tone: 'profit' };
      const enough = state.company.cash >= def.price;
      return { text: enough ? `${formatMoney(def.price, mode)}（買えます）` : `${formatMoney(def.price, mode)}（あと ${formatMoney(def.price - state.company.cash, mode)}）`, tone: enough ? 'profit' : 'warn' };
    }
    return { text: KIND_LABEL[b.kind], tone: 'default' };
  };

  return (
    <div className="list">
      <Card flat>
        <div className="card__body text-sub" style={{ fontSize: 12 }}>
          印を押すと地図がその場所へ飛びます。メモを書いておくと、何を考えていたか後から分かります（{list.length}件）。
        </div>
      </Card>
      {list.map((b) => {
        const st = statusOf(b);
        const key = `${b.kind}:${b.id}`;
        return (
          <Card key={key}>
            <div className="card__head">
              <Icon name={KIND_ICON[b.kind]} size={30} fallback={KIND_LABEL[b.kind].slice(0, 2)} />
              <div className="row__grow">
                <div className="card__title">{b.label}</div>
                <div className="card__sub">
                  {b.sub ? `${b.sub}・` : ''}
                  {KIND_LABEL[b.kind]}・本社から {formatDistance(distanceKm(hq, b))}
                </div>
                <div className={`text-${st.tone === 'default' ? 'dim' : st.tone}`} style={{ fontSize: 12, fontWeight: 700 }}>
                  {st.text}
                </div>
                {b.note && !editing && (
                  <div className="text-sub" style={{ fontSize: 12, marginTop: 2 }}>
                    メモ: {b.note}
                  </div>
                )}
              </div>
            </div>
            {editing === key && (
              <div className="card__body">
                <div className="row">
                  <input
                    className="input"
                    value={draft}
                    maxLength={120}
                    placeholder="例: 駅から近い。値下がりを待つ"
                    onChange={(e) => setDraft(e.target.value)}
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      engine.setBookmarkNote(b.kind, b.id, draft);
                      setEditing(null);
                      bumpGame();
                    }}
                  >
                    保存
                  </Button>
                </div>
              </div>
            )}
            <div className="card__body">
              <div className="btn-row">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setMapSubTab('map');
                    flyTo(b.lat, b.lon, b.kind === 'feature' ? 18 : 13);
                  }}
                >
                  地図で見る
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditing(editing === key ? null : key);
                    setDraft(b.note ?? '');
                  }}
                >
                  {b.note ? 'メモを直す' : 'メモを書く'}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    engine.removeBookmark(b.kind, b.id);
                    bumpGame();
                  }}
                >
                  印を外す
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
