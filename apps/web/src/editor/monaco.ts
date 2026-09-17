import { loader } from '@monaco-editor/react';
// The editor core, without any language service. Importing `monaco-editor`
// wholesale pulls in every language Monaco ships and their workers - about nine
// megabytes of TypeScript, CSS, HTML and JSON tooling this app never uses.
import * as monaco from 'monaco-editor/editor/editor.api.js';
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker';
// The two languages the judge runs, registered explicitly. Each is a tokenizer
// and a set of language configuration rules; neither needs a worker.
import 'monaco-editor/languages/definitions/python/register.js';
import 'monaco-editor/languages/definitions/java/register.js';

/**
 * Monaco, bundled rather than fetched (ROADMAP P4-1, D1).
 *
 * `@monaco-editor/react` loads Monaco from a CDN by default. That is wrong here
 * twice over: this app is local-first and has to work with no network at all
 * except for the coach, and a local judge that reaches out to a CDN to render an
 * editor is exactly the kind of surprise dependency the whole design avoids.
 * `loader.config` points it at the copy Vite bundles instead.
 *
 * The specifiers above are `monaco-editor/editor/...` rather than the
 * `monaco-editor/esm/vs/editor/...` spelling most guides still show: Monaco 0.56
 * ships an `exports` map that already prefixes `esm/vs`, so the older path
 * resolves to `esm/vs/esm/vs/...` and fails to build.
 */

declare global {
  interface Window {
    MonacoEnvironment?: { getWorker: () => Worker };
  }
}

self.MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
};

loader.config({ monaco });

/** Monaco's language id for each language we run. */
export const MONACO_LANGUAGE = {
  python: 'python',
  java: 'java',
} as const;
