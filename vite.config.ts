/* Sentry · Build config
   `npm run build` bundles the React app into ONE file, dist/index.html, so it
   works from `npm start`, opened straight from disk, or on any static host. */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: { outDir: 'dist', emptyOutDir: true }
});
