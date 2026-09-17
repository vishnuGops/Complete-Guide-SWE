import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const shared = fileURLToPath(new URL('./packages/shared/src/index.ts', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@devpromax/shared': shared,
    },
  },
  test: {
    globals: true,
    projects: [
      {
        resolve: { alias: { '@devpromax/shared': shared } },
        test: {
          name: 'shared',
          environment: 'node',
          include: ['packages/shared/src/**/*.test.ts'],
        },
      },
      {
        resolve: { alias: { '@devpromax/shared': shared } },
        test: {
          name: 'server',
          environment: 'node',
          include: ['apps/server/src/**/*.test.ts'],
          // Judge integration tests spawn real python/java processes.
          testTimeout: 60_000,
          hookTimeout: 60_000,
        },
      },
      {
        resolve: { alias: { '@devpromax/shared': shared } },
        test: {
          name: 'web',
          environment: 'jsdom',
          include: ['apps/web/src/**/*.test.{ts,tsx}'],
          setupFiles: ['./apps/web/src/test/setup.ts'],
        },
      },
    ],
  },
});
