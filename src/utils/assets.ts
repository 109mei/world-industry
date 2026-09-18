/** assets/icons 内の画像 URL を返す。base が './' でも GitHub Pages でも動くよう BASE_URL を使う */
export function iconUrl(name: string): string {
  const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
  return `${base}assets/icons/${name}.png`;
}

/**
 * まだ絵が用意できていないアイコンの、当面の代わり。
 *
 * 新しい機能を足すとアイコンの名前が先に決まるので、絵が届くまでは
 * ここに「近い意味の既存アイコン」を書いておく。絵を assets/icons に置けば、
 * この表から消すだけで本物に切り替わる（消し忘れても本物が優先される）。
 * 必要な素材の一覧は docs/assets-needed.html にまとめてある。
 */
export const ICON_FALLBACK: Record<string, string> = {
  // いまは全部そろっている。新しい絵を待つあいだだけ、ここに「近い意味の既存アイコン」を書く
};

/** assets/art の中の絵（台の絵など）の URL */
export function artUrl(name: string): string {
  const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
  return `${base}assets/art/${name}.png`;
}

/**
 * assets/cards の中の絵の URL。
 * トランプの絵札は png、モンスターカード100種は webp で置いてある。
 */
export function cardArtUrl(name: string, ext: 'png' | 'webp' = 'png'): string {
  const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
  return `${base}assets/cards/${name}.${ext}`;
}

/** そのアイコンの代わりに出すもの（なければ undefined） */
export function iconFallback(name: string): string | undefined {
  return ICON_FALLBACK[name];
}
