/**
 * Row helpers shared by the repositories.
 *
 * `node:sqlite` hands back null-prototype objects whose values are typed as a
 * union of everything SQLite can hold. Every repository therefore converts a row
 * explicitly and, for anything that also crosses the API boundary, parses the
 * result with the shared zod schema. That parse is not ceremony: it is what
 * turns "the schema drifted from the types" from a bug users hit into a test
 * that fails.
 */

export type Row = Record<string, unknown>;

export function text(row: Row, column: string): string {
  const value = row[column];
  if (typeof value !== 'string') {
    throw new Error(`Expected column "${column}" to be text, got ${describe(value)}.`);
  }
  return value;
}

export function nullableText(row: Row, column: string): string | null {
  const value = row[column];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    throw new Error(`Expected column "${column}" to be text or NULL, got ${describe(value)}.`);
  }
  return value;
}

export function num(row: Row, column: string): number {
  const value = row[column];
  // INTEGER columns come back as bigint when the value exceeds 2^53; none of
  // ours can, but converting is cheaper than being surprised.
  if (typeof value === 'bigint') return Number(value);
  if (typeof value !== 'number') {
    throw new Error(`Expected column "${column}" to be numeric, got ${describe(value)}.`);
  }
  return value;
}

/** Parses a JSON column, returning `fallback` when it is NULL. */
export function json<T>(row: Row, column: string, fallback: T): T {
  const value = nullableText(row, column);
  if (value === null) return fallback;
  return JSON.parse(value) as T;
}

function describe(value: unknown): string {
  return value === null ? 'NULL' : typeof value;
}
