import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { CITIES } from '@/game/data/cities';
import { hqLocation, placeLabel } from '@/game/engine/hq';
import { bumpGame, useGame } from '@/stores/gameStore';

/**
 * 最初に1回だけ、本社をどこに置くか決める。
 * 決めたあとは変えられないので、決まるまではここから先に進めない。
 */
export function HqSetupCard() {
  const { state, engine } = useGame();
  const [busy, setBusy] = useState(false);
  const [pickCity, setPickCity] = useState(false);
  const [message, setMessage] = useState('');
  if (state.settings.hqChosen) return null;
  const here = hqLocation(state);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setMessage('この端末では位置情報が使えません。下の「街から選ぶ」で決められます。');
      setPickCity(true);
      return;
    }
    setBusy(true);
    setMessage('位置情報を取得しています…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        const { latitude, longitude } = pos.coords;
        engine.setHqLocation(latitude, longitude, placeLabel(latitude, longitude));
        bumpGame();
      },
      () => {
        setBusy(false);
        setMessage('位置情報を取得できませんでした。ブラウザで許可するか、「街から選ぶ」で決められます。');
        setPickCity(true);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  };

  return (
    <Card>
      <div className="card__head">
        <Icon name="icon_ui_company" size={36} fallback="本社" />
        <div className="row__grow">
          <div className="card__title">まず本社をどこに置くか決めます</div>
          <div className="card__sub">
            最初に1回だけ決められます（あとから変えられません）。決めるまで先に進めません。いまの候補は {here.label} です。
          </div>
        </div>
      </div>
      <div className="card__body">
        <p className="text-sub" style={{ fontSize: 12, marginTop: 0 }}>
          本社は地図に表示され、会社の拠点になります。自分の住んでいる場所を本社にすると、見慣れた土地から会社を広げていけます。
        </p>
        <div className="btn-row">
          <Button variant="primary" size="sm" disabled={busy} onClick={useMyLocation}>
            {busy ? '取得中…' : '現在地を本社にする'}
          </Button>
          <Button size="sm" onClick={() => setPickCity((v) => !v)}>
            街から選ぶ {pickCity ? '▲' : '▼'}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              engine.keepDefaultHq();
              bumpGame();
            }}
          >
            大阪のままにする
          </Button>
        </div>
        {pickCity && (
          <div className="grid grid--2" style={{ marginTop: 8 }}>
            {CITIES.map((c) => (
              <Button
                key={c.id}
                size="sm"
                onClick={() => {
                  engine.setHqLocation(c.lat, c.lon, c.name);
                  bumpGame();
                }}
              >
                {c.name}
                <span className="text-sub" style={{ fontSize: 11, marginLeft: 4 }}>
                  {c.country}
                </span>
              </Button>
            ))}
          </div>
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
