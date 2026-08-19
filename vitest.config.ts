import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    pool: 'forks',

    include: ['tests/**/*.test.ts', 'components/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['utils/**/*.ts', 'constants/**/*.ts', 'components/**/*.ts'],
    },
  },
});
