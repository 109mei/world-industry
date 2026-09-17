/** 本社の場所（設定していなければ初期値の大阪） */
import { HQ_LOCATION } from '@/game/data/lands';
import { estimateLandValue } from '@/game/data/landValue';
import type { GameState } from '@/types/state';

export interface HqPlace {
  lat: number;
  lon: number;
  label: string;
}

export function hqLocation(state: GameState): HqPlace {
  const v = state.settings?.hqLocation;
  if (v && Number.isFinite(v.lat) && Number.isFinite(v.lon)) return { lat: v.lat, lon: v.lon, label: v.label || '本社' };
  return { lat: HQ_LOCATION.lat, lon: HQ_LOCATION.lon, label: '大阪' };
}

/** 座標から表示用の地名を作る（近い都市の名前と距離） */
export function placeLabel(lat: number, lon: number): string {
  const v = estimateLandValue({ lat, lon });
  if (v.distanceKm < 3) return v.nearestCityName;
  if (v.distanceKm < 60) return `${v.nearestCityName}から${Math.round(v.distanceKm)}km`;
  return `${v.nearestCityName}の方面`;
}
