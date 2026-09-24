/**
 * Model housekeeping for the editor (ROADMAP P4-15).
 *
 * Apart from `CodeEditor.tsx` so it can be tested without Monaco: both
 * functions take the few methods they use, and a test hands them fakes.
 */

/** The part of a Monaco model the housekeeping here needs. */
export interface ModelLike {
  uri: { path: string };
  isDisposed: () => boolean;
  dispose: () => void;
}

/** The part of the Monaco API the housekeeping here needs. */
export interface MonacoModelsLike {
  editor: {
    getModels: () => ModelLike[];
    getEditors: () => { getModel: () => unknown }[];
  };
}

/** `two-sum.python` belongs to the family `two-sum`: one problem, any language. */
function familyOf(path: string): string {
  const name = path.replace(/^\/+/, '');
  const dot = name.lastIndexOf('.');
  return dot === -1 ? name : name.slice(0, dot);
}

/**
 * Disposes every model that belongs to another problem and is not on screen
 * in any editor. Returns how many went, for the test.
 */
export function disposeStaleModels(monaco: MonacoModelsLike, path: string): number {
  const keep = familyOf(path);
  const inUse = new Set(monaco.editor.getEditors().map((editor) => editor.getModel()));
  let disposed = 0;
  for (const model of monaco.editor.getModels()) {
    if (model.isDisposed() || inUse.has(model) || familyOf(model.uri.path) === keep) continue;
    model.dispose();
    disposed += 1;
  }
  return disposed;
}

/**
 * Makes a freshly mounted editor show `value`. True when it had to.
 *
 * `@monaco-editor/react` only pushes `value` into the editor when the prop
 * *changes*; on mount it takes whatever the model for `path` already holds.
 */
export function syncMountedValue(
  editor: { getValue: () => string; setValue: (value: string) => void },
  value: string,
): boolean {
  if (editor.getValue() === value) return false;
  editor.setValue(value);
  return true;
}
