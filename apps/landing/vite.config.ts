import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        landing: path.resolve(import.meta.dirname, './index.html'),
        privacy: path.resolve(import.meta.dirname, './privacy.html'),
        terms: path.resolve(import.meta.dirname, './terms.html'),
      },
    },
  },
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(import.meta.dirname, './src') },
    ],
  },
});
