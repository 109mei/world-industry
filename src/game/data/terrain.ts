/** 地形。土地ごとに1つ。施設の建設可否や効率に影響する */
export type TerrainId = 'industrial' | 'city' | 'plains' | 'forest' | 'mountain' | 'coast' | 'desert' | 'river' | 'snow';

export interface TerrainDef {
  id: TerrainId;
  name: string;
  icon: string;
  description: string;
}

export const TERRAINS: Record<TerrainId, TerrainDef> = {
  industrial: { id: 'industrial', name: '工業地帯', icon: 'icon_terrain_industrial', description: '工場に向く。人口も多い。' },
  city: { id: 'city', name: '都市', icon: 'icon_terrain_city', description: '人口と交通量が多く、商業施設の収益が高い。' },
  plains: { id: 'plains', name: '平原', icon: 'icon_terrain_farmland', description: '広い農地。農園の効率が高い。' },
  forest: { id: 'forest', name: '森林', icon: 'icon_terrain_forest', description: '木材が豊富。伐採の効率が高い。' },
  mountain: { id: 'mountain', name: '山岳', icon: 'icon_terrain_mountain', description: '鉱脈が多い。風力・水力に向く。' },
  coast: { id: 'coast', name: '沿岸', icon: 'icon_terrain_coast', description: '港が使える。船で大量輸送できる。風力に向く。' },
  desert: { id: 'desert', name: '砂漠', icon: 'icon_terrain_desert', description: '日照が強く太陽光に最適。油田や鉱山も多い。' },
  river: { id: 'river', name: '河川', icon: 'icon_terrain_river', description: '水力発電に最適。農地にも向く。' },
  snow: { id: 'snow', name: '寒冷地', icon: 'icon_terrain_snow', description: '過酷だが資源が豊富。' },
};

export const TERRAIN_IDS = Object.keys(TERRAINS) as TerrainId[];
