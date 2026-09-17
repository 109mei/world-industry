import { Map as MlMap, NavigationControl, type GeoJSONSource, type MapGeoJSONFeature, type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';
import { PROPERTY_KIND } from '@/game/data/properties';
import type { OsmFeature } from '@/game/services/osm/overpass';

/** 無料・キー不要のベクタータイル（OpenStreetMap 由来）。建物の高さが入っている */
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
/** 1階あたりの高さ（m） */
const FLOOR_M = 3.2;

export interface View3D {
  lat: number;
  lon: number;
  zoom: number;
  bounds: { south: number; west: number; north: number; east: number };
}

interface Props {
  center: { lat: number; lon: number; zoom: number };
  features: OsmFeature[];
  ownedIds: string[];
  onSelect: (f: OsmFeature) => void;
  onView: (v: View3D) => void;
  onError?: (message: string) => void;
}

function toGeoJson(features: OsmFeature[], owned: Set<string>) {
  return {
    type: 'FeatureCollection' as const,
    features: features
      .filter((f) => f.polygon.length >= 4)
      .map((f) => ({
        type: 'Feature' as const,
        id: undefined,
        properties: {
          wiId: f.id,
          name: f.name,
          label: f.label,
          color: PROPERTY_KIND[f.kind].color,
          height: Math.max(3, Math.round(Math.max(1, f.levels) * FLOOR_M)),
          owned: owned.has(f.id) ? 1 : 0,
        },
        geometry: { type: 'Polygon' as const, coordinates: [f.polygon.map((p) => [p.lon, p.lat])] },
      })),
  };
}

/** 近づいたときの立体表示（グーグルアース風）。建物をタップして買えるのは2Dと同じ */
export function Map3D({ center, features, ownedIds, onSelect, onView, onError }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const featuresRef = useRef(features);
  featuresRef.current = features;
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const viewRef = useRef(onView);
  viewRef.current = onView;

  useEffect(() => {
    const el = ref.current;
    if (!el || mapRef.current) return;
    let map: MlMap;
    try {
      map = new MlMap({
        container: el,
        style: STYLE_URL,
        center: [center.lon, center.lat],
        zoom: center.zoom,
        pitch: 55,
        bearing: -15,
        maxZoom: 21,
        attributionControl: { compact: true },
      });
    } catch (e) {
      onError?.(e instanceof Error ? e.message : '立体表示を作れませんでした');
      return;
    }
    mapRef.current = map;
    map.addControl(new NavigationControl({ visualizePitch: true }), 'top-left');
    map.on('error', (ev: unknown) => {
      const msg = (ev as { error?: { message?: string } }).error?.message;
      if (msg) onError?.(msg);
    });
    const report = () => {
      const c = map.getCenter();
      const b = map.getBounds();
      viewRef.current({ lat: c.lat, lon: c.lng, zoom: map.getZoom(), bounds: { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() } });
    };
    map.on('moveend', report);
    map.on('load', () => {
      // 街の建物を立体にする（スタイルに建物のデータが入っている場合）
      try {
        const layers = ((map.getStyle() as StyleSpecification).layers ?? []) as { id: string }[];
        const hasBuilding = layers.some((l) => l.id === 'building-3d' || l.id === 'building');
        if (!hasBuilding) {
          map.addLayer({
            id: 'wi-city-3d',
            type: 'fill-extrusion',
            source: 'openmaptiles',
            'source-layer': 'building',
            minzoom: 15,
            paint: {
              'fill-extrusion-color': '#6b7480',
              'fill-extrusion-height': ['coalesce', ['get', 'render_height'], ['*', ['coalesce', ['get', 'levels'], 2], FLOOR_M]],
              'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
              'fill-extrusion-opacity': 0.9,
            },
          });
        }
      } catch {
        // スタイルに建物がなければ、下のゲーム用レイヤーだけ出す
      }
      // ゲームで買える建物・区画
      map.addSource('wi', { type: 'geojson', data: toGeoJson(featuresRef.current, new Set(ownedIds)) });
      map.addLayer({
        id: 'wi-3d',
        type: 'fill-extrusion',
        source: 'wi',
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': ['case', ['==', ['get', 'owned'], 1], 0.95, 0.65],
        },
      });
      map.on('click', 'wi-3d', (ev: { features?: MapGeoJSONFeature[] }) => {
        const hit = (ev.features ?? [])[0] as MapGeoJSONFeature | undefined;
        const id = hit?.properties?.wiId as string | undefined;
        if (!id) return;
        const f = featuresRef.current.find((x) => x.id === id);
        if (f) selectRef.current(f);
      });
      map.on('mouseenter', 'wi-3d', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'wi-3d', () => {
        map.getCanvas().style.cursor = '';
      });
      report();
    });
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 建物の更新
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource('wi') as GeoJSONSource | undefined;
    if (src) src.setData(toGeoJson(features, new Set(ownedIds)));
  }, [features, ownedIds]);

  return <div className="rm__map rm__map--3d" ref={ref} />;
}
