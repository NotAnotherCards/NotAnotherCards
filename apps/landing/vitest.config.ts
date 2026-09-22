import { defineConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

export default defineConfig({
  ...viteConfig,
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
