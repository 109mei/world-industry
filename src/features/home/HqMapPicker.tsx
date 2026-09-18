import L from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { hqLocation } from '@/game/engine/hq';
import { reverseGeocode } from '@/game/services/geo/reverseGeocode';
import { useGame } from '@/stores/gameStore';

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

interface Props {
  /** 最初に表示する場所 */
  start?: { lat: number; lon: number } | null;
  onPick: (lat: number, lon: number, label: string) => void;
  onCancel: () => void;
}

/**
 * 本社の場所を地図から決める。
 * 真ん中の十字が置く場所で、動かすたびにその住所を引いて出す。
 */
export function HqMapPicker({ start, onPick, onCancel }: Props) {
  const { state } = useGame();
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [center, setCenter] = useState(() => start ?? hqLocation(state));
  const [address, setAddress] = useState<string>('');
  const [looking, setLooking] = useState(false);
  const [tileError, setTileError] = useState(false);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || mapRef.current) return;
    const map = L.map(el, { zoomControl: true, attributionControl: true }).setView([center.lat, center.lon], start ? 15 : 10);
    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: ATTRIBUTION })
      .on('tileerror', () => setTileError(true))
      .addTo(map);
    map.on('moveend', () => {
      const c = map.getCenter();
      setCenter({ lat: c.lat, lon: c.lng });
    });
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 60);
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // 地図は1回だけ作る
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 真ん中を動かすたびに住所を引く（少し待ってから）
  useEffect(() => {
    const ctrl = new AbortController();
    setLooking(true);
    // 住所が引けなくても決められるように、待つのは最長5秒まで
    const giveUp = setTimeout(() => {
      ctrl.abort();
      setLooking(false);
    }, 5600);
    const t = setTimeout(async () => {
      const place = await reverseGeocode(center.lat, center.lon, ctrl.signal);
      setAddress(place?.label ?? '');
      setLooking(false);
      clearTimeout(giveUp);
    }, 600);
    return () => {
      clearTimeout(t);
      clearTimeout(giveUp);
      ctrl.abort();
    };
  }, [center.lat, center.lon]);

  return (
    <div className="hq-picker">
      <div className="hq-picker__stage">
        <div ref={boxRef} className="hq-picker__map" role="application" aria-label="本社の場所を選ぶ地図" />
        <div className="hq-picker__cross" aria-hidden="true">
          <span />
          <span />
        </div>
        {tileError && <div className="rm__notice">地図の画像を読み込めません。場所は選べます。</div>}
      </div>
      <div className="hq-picker__foot">
        <div className="row__grow">
          <div style={{ fontSize: 13, fontWeight: 600 }}>{looking ? '住所を調べています…' : address || 'この場所'}</div>
          <div className="text-sub num" style={{ fontSize: 11 }}>
            {center.lat.toFixed(5)}, {center.lon.toFixed(5)}
          </div>
        </div>
        <div className="btn-row">
          <Button size="sm" variant="primary" onClick={() => onPick(center.lat, center.lon, address)}>
            ここを本社にする
          </Button>
          <Button size="sm" onClick={onCancel}>
            やめる
          </Button>
        </div>
      </div>
    </div>
  );
}
