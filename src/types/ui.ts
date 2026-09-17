export type NavTab = 'home' | 'craft' | 'factory' | 'map' | 'research' | 'settings';

export interface NavItem {
  id: NavTab;
  label: string;
  labelJa: string;
  icon: string;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'HOME', labelJa: 'ホーム', icon: 'icon_ui_company' },
  { id: 'craft', label: 'CRAFT', labelJa: 'クラフト', icon: 'icon_ui_craft' },
  { id: 'factory', label: 'FACTORY', labelJa: '施設', icon: 'icon_ui_factory' },
  { id: 'map', label: 'MAP', labelJa: '地図', icon: 'icon_ui_location' },
  { id: 'research', label: 'RESEARCH', labelJa: '研究', icon: 'icon_ui_research' },
  { id: 'settings', label: 'SETTINGS', labelJa: '設定', icon: 'icon_ui_settings' },
];
