import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig({
  // GitHub Pages serves a repo NOT named '<username>.github.io' from a
  // subpath (https://<username>.github.io/grim-triad/), not the domain
  // root - this tells Vite to prefix every asset/script/style reference
  // it generates with that subpath. See src/utils/publicAssetPath.ts for
  // the runtime counterpart: a handful of components construct a
  // public/ asset URL themselves (faction icons, card backs, etc.)
  // rather than importing the asset as a module, and those need this
  // same base respected explicitly, since Vite's own asset-rewriting
  // only covers imports it can see at build time.
  base: '/grim-triad/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
});