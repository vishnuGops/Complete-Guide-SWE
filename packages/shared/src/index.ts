/**
 * The single source of truth for every request/response shape crossing the
 * web <-> server boundary, and for the on-disk problem package format.
 * Both sides import from here; nothing is redeclared locally.
 */
export * from './json.js';
export * from './language.js';
export * from './curriculum.js';
export * from './patterns.js';
export * from './problem.js';
export * from './judge.js';
export * from './customTests.js';
export * from './progress.js';
export * from './coach.js';
export * from './cost.js';
export * from './diff.js';
export * from './settings.js';
export * from './api.js';
