import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',        // le domaine est pur : pas besoin du DOM
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: { provider: 'v8', include: ['src/domaine/**'], reporter: ['text'] },
  },
});
