export type NavTab = 'home' | 'resources' | 'craft' | 'land' | 'estate' | 'factory' | 'company';

export interface NavItem {
  id: NavTab;
  label: string;
  labelJa: string;
  icon: string;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'HOME', labelJa: 'ホーム', icon: 'icon_ui_company' },
  { id: 'resources', label: 'RESOURCES', labelJa: '資源', icon: 'icon_ui_inventory' },
  { id: 'craft', label: 'CRAFT', labelJa: 'クラフト', icon: 'icon_ui_craft' },
  { id: 'factory', label: 'FACTORY', labelJa: '施設', icon: 'icon_ui_factory' },
  { id: 'land', label: 'LAND', labelJa: '土地', icon: 'icon_ui_land' },
  { id: 'estate', label: 'ESTATE', labelJa: '不動産・株', icon: 'icon_ui_location' },
  { id: 'company', label: 'COMPANY', labelJa: '会社', icon: 'icon_ui_chart' },
];
