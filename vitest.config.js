import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.property.test.js'],
  },
});
