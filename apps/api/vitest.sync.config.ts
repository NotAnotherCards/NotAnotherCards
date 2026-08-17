import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/sync/**/*.test.ts', 'src/**/*.test.ts'],
    fileParallelism: false,
  },
});
