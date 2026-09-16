/** assets/icons 内の画像 URL を返す。base が './' でも GitHub Pages でも動くよう BASE_URL を使う */
export function iconUrl(name: string): string {
  const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
  return `${base}assets/icons/${name}.png`;
}
