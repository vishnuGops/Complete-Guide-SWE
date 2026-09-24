import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/*
 * Every project resolves `@devpromax/shared` to its source, not its `dist`.
 * Written once and handed to each project: inline projects do not inherit the
 * root's `resolve`, so a root-level copy only looked like it applied.
 */
const resolve = {
  alias: {
    '@devpromax/shared': fileURLToPath(new URL('./packages/shared/src/index.ts', import.meta.url)),
  },
};

const INTEGRATION = '**/*.integration.test.ts';

export default defineConfig({
  test: {
    /*
     * Measured, never enforced (ROADMAP P8-7). `npm run test:coverage` writes
     * a summary to the terminal and an HTML report to `coverage/`; there is no
     * threshold, because a number that fails the build gets tests written to
     * move the number. What it is for is finding the modules nothing runs.
     */
    coverage: {
      provider: 'v8',
      include: ['packages/shared/src/**', 'apps/server/src/**', 'apps/web/src/**'],
      exclude: ['**/*.test.{ts,tsx}', '**/__fixtures__/**', 'apps/web/src/test/**'],
      reporter: ['text-summary', 'html'],
      reportsDirectory: 'coverage',
    },
    projects: [
      {
        resolve,
        test: {
          name: 'shared',
          environment: 'node',
          include: ['packages/shared/src/**/*.test.ts'],
        },
      },
      {
        resolve,
        test: {
          name: 'server',
          environment: 'node',
          include: ['apps/server/src/**/*.test.ts'],
          exclude: [INTEGRATION],
          // Kept from when this project also held the integration files: the
          // API tests build a whole server over the real catalogue, which is
          // not a five-second job on the slower machine.
          testTimeout: 60_000,
          hookTimeout: 60_000,
        },
      },
      /*
       * The tests that spawn real interpreters, one file at a time (ROADMAP P8-7).
       *
       * Their time limits are the judge's, and the judge's limits are written
       * for one run on the slower machine. Four files at once on four cores -
       * each starting JVMs and a queue of its own - measured the machine rather
       * than the judge: a Java StackOverflowError came back as a time limit
       * because the JVM that would have thrown it was still waiting for a core.
       * Serial costs wall time, which is the cheaper thing to lose. Tests
       * *inside* a file keep whatever concurrency the file asks for.
       */
      {
        resolve,
        test: {
          name: 'server-integration',
          environment: 'node',
          include: [`apps/server/src/${INTEGRATION}`],
          fileParallelism: false,
          testTimeout: 60_000,
          hookTimeout: 60_000,
        },
      },
      {
        resolve,
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
