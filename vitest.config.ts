import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,js}', 'tests/**/*.{test,spec}.{ts,js}'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'src/types.ts',
        'src/cli/**',
        'src/**/*.spec.ts',
        'src/**/*.test.ts',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/coverage/**'
      ]
    },
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  define: {
    __TEST__: true,
    __DEMO__: true,
  },
});