import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',

    include: ['tests/**/*.test.ts', 'components/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['utils/**/*.ts', 'constants/**/*.ts', 'components/**/*.ts'],
    },
  },
});
