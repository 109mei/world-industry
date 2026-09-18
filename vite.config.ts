/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { GAME_META } from './src/game/data/meta.ts';

// index.html 内の %GAME_TITLE% などを meta.ts の値で置き換える（タイトルは meta.ts の1か所で管理）
function gameMetaPlugin() {
  return {
    name: 'world-industry-meta',
    transformIndexHtml(html: string) {
      return html
        .replaceAll('%GAME_TITLE%', GAME_META.title)
        .replaceAll('%GAME_DESCRIPTION%', GAME_META.description)
        .replaceAll('%THEME_COLOR%', GAME_META.themeColor)
        .replaceAll('%SITE_URL%', GAME_META.siteUrl)
        .replaceAll('%GAME_TAGLINE%', GAME_META.tagline);
    },
  };
}

export default defineConfig({
  // 相対パスで出力する。GitHub Pages（/world-industry/ 配下）でも、別の場所に置いてもそのまま動く
  base: './',
  plugins: [react(), gameMetaPlugin()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
