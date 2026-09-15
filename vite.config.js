import { defineConfig } from 'vite';

export default defineConfig({
  // 相対パスで出力する。GitHub Pages（/world-industry/ 配下）でも、
  // ほかのゲーム投稿サイトにアップロードしても、そのまま動くようにするため
  base: './',
});
