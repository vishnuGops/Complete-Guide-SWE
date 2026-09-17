import type { ProviderOptions } from '../../coach/index.js';
import type { Repositories } from '../../db/index.js';
import type { Catalogue } from '../catalogue.js';
import type { JudgeFn } from '../runService.js';

/**
 * What every route needs, passed in rather than imported.
 *
 * The API tests build a server over an in-memory database, a catalogue pointed
 * at fixtures and a stand-in judge; production passes the real three. Nothing in
 * `routes/` reaches for a module-level singleton, which is what keeps that
 * possible.
 */
export interface ApiDeps {
  repos: Repositories;
  catalogue: Catalogue;
  /** Directory the catalogue was built from; the judge loads tests from it too. */
  problemsRoot?: string;
  /** Stand-in judge for tests that must not spawn an interpreter. */
  judge?: JudgeFn;
  /** Environment the `COACH_API_KEY` override is read from. */
  env?: NodeJS.ProcessEnv;
  /** Injected `fetch` for the coach provider, so tests stay offline. */
  provider?: ProviderOptions;
}
