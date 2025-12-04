import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  plugins: [],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    reporters: ['default'],
    coverage: {
      reporter: ['text', 'lcov'],
      provider: 'v8',
    },
  },
});
