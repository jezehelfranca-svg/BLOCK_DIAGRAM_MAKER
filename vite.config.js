import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative asset paths make the production bundle work under the
  // /BLOCK_DIAGRAM_MAKER/ GitHub Pages project path as well as local hosting.
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: true },
});
