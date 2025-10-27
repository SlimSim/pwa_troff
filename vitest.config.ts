import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',

    include: ['tests/**/*.test.mjs'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['scriptTroffClass.mjs', '*.mjs', '*.html'], // add more source files if needed
    },
  },
});
