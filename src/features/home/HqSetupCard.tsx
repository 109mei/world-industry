import { lazy, Suspense, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { hqLocation, placeLabel } from '@/game/engine/hq';
import { reverseGeocode } from '@/game/services/geo/reverseGeocode';
import { bumpGame, useGame } from '@/stores/gameStore';

// 地図は重いので、選ぶと言われてから読み込む
const HqMapPicker = lazy(() => import('./HqMapPicker').then((m) => ({ default: m.HqMapPicker })));

/**
 * 最初に1回だけ、本社をどこに置くか決める。
 * 決めたあとは変えられないので、決まるまではここから先に進めない。
 */
export function HqSetupCard() {
  const { state, engine } = useGame();
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [here, setHere] = useState<{ lat: number; lon: number } | null>(null);
  const [message, setMessage] = useState('');
  if (state.settings.hqChosen) return null;
  const fallback = hqLocation(state);

  /** 住所を引いてから本社を決める（引けなければ近くの都市名） */
  const decide = async (lat: number, lon: number, known?: string) => {
    let label = known?.trim() ?? '';
    if (!label) {
      const place = await reverseGeocode(lat, lon);
      label = place?.label ?? placeLabel(lat, lon);
    }
    engine.setHqLocation(lat, lon, label);
    bumpGame();
  };

  /** 位置情報は1回だけ取りに行く（取れたらそのまま本社の候補にする） */
  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setMessage('この端末では位置情報が使えません。「マップから選ぶ」で決められます。');
      setPicking(true);
      return;
    }
    setBusy(true);
    setMessage('位置情報を取得しています…');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setHere({ lat: latitude, lon: longitude });
        const place = await reverseGeocode(latitude, longitude);
        setBusy(false);
        setMessage(place ? `現在地は ${place.label} です。ここでよければ決定してください。` : '現在地を取得しました。地図で確かめてから決めてください。');
        // 取れた場所を地図の初期位置にして、確認してから決めてもらう
        setPicking(true);
      },
      () => {
        setBusy(false);
        setMessage('位置情報を取得できませんでした。ブラウザで許可するか、「マップから選ぶ」で決められます。');
        setPicking(true);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 600000 },
    );
  };

  return (
    <Card>
      <div className="card__head">
        <Icon name="icon_ui_company" size={36} fallback="本社" />
        <div className="row__grow">
          <div className="card__title">まず本社をどこに置くか決めます</div>
          <div className="card__sub">
            最初に1回だけ決められます（あとから変えられません）。決めるまで先に進めません。
          </div>
        </div>
      </div>
      <div className="card__body">
        <p className="text-sub" style={{ fontSize: 12, marginTop: 0 }}>
          本社は地図に表示され、会社の拠点になります。住んでいる町や、よく知っている場所にすると、
          見慣れた景色から会社を広げていけます。番地の細かいところまで選べます。
        </p>
        <div className="btn-row">
          <Button variant="primary" size="sm" disabled={busy} onClick={useMyLocation}>
            {busy ? '取得中…' : '現在地から決める'}
          </Button>
          <Button size="sm" onClick={() => setPicking((v) => !v)}>
            {picking ? '地図を閉じる' : 'マップから選ぶ'}
          </Button>
        </div>

        {picking && (
          /*
           * 地図はあとから読み込む部分なので、電波が悪い・公開直後で古いファイル名を
           * 取りに行った、といったときに失敗しうる。受け皿が無いと真っ白になって
           * 本社を決められず、読み直しても同じ画面に戻って先へ進めなくなる。
           * そのときだけ「決めずに始める」を出して、行き止まりを作らない。
           */
          <ErrorBoundary
            fallback={(retry) => (
              <div className="card" style={{ padding: 12, marginTop: 8 }}>
                <div className="card__sub">地図を開けませんでした。通信が不安定なときに起きます。</div>
                <div className="btn-row" style={{ marginTop: 8 }}>
                  <Button size="sm" onClick={retry}>
                    もう一度ためす
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      engine.keepDefaultHq();
                      bumpGame();
                    }}
                  >
                    決めずに始める（大阪）
                  </Button>
                </div>
              </div>
            )}
          >
          <Suspense fallback={<div className="text-sub" style={{ fontSize: 12, padding: '12px 0' }}>地図を読み込み中…</div>}>
            <HqMapPicker
              start={here ?? { lat: fallback.lat, lon: fallback.lon }}
              onPick={(lat, lon, label) => {
                void decide(lat, lon, label);
              }}
              onCancel={() => setPicking(false)}
            />
          </Suspense>
          </ErrorBoundary>
        )}

        {message && (
          <div className="text-sub" style={{ fontSize: 12, marginTop: 6 }}>
            {message}
          </div>
        )}
      </div>
    </Card>
  );
}
