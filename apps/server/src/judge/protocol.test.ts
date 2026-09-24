import { describe, expect, it } from 'vitest';
import { firstNonFinite, isFatal, parseResultLines, parseResults } from './protocol.js';

describe('parseResultLines', () => {
  it('reads one record per line', () => {
    const records = parseResultLines(
      [
        '{"index":0,"status":"ok","returned":[0,1],"timeMs":1.5}',
        '{"index":1,"status":"error","error":{"type":"ValueError","message":"boom"},"timeMs":0.4}',
      ].join('\n'),
    );

    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({ index: 0, status: 'ok', returned: [0, 1] });
    expect(records[1]).toMatchObject({ index: 1, status: 'error' });
  });

  it('fills the defaults a terse harness record omits', () => {
    const [record] = parseResultLines('{"index":0,"status":"ok","returned":1}');
    expect(record).toMatchObject({ stdout: '', stderr: '', timeMs: 0, outputTruncated: false });
  });

  it('keeps the completed records when the last line is half-written', () => {
    // Exactly what a killed process leaves behind, and the reason the isolation
    // fallback can tell which test was still running.
    const records = parseResultLines(
      '{"index":0,"status":"ok","returned":1,"timeMs":1}\n{"index":1,"stat',
    );
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ index: 0 });
  });

  it('ignores blank lines and trailing newlines', () => {
    expect(parseResultLines('\n\n{"index":0,"status":"ok"}\n\n')).toHaveLength(1);
    expect(parseResultLines('')).toEqual([]);
    expect(parseResultLines('   \n')).toEqual([]);
  });

  it('drops a line that parses as JSON but is not a record', () => {
    const records = parseResultLines('{"hello":"world"}\n{"index":0,"status":"ok"}');
    expect(records).toHaveLength(1);
  });

  it('recognises a fatal record and keeps its position information', () => {
    const [record] = parseResultLines(
      '{"event":"fatal","kind":"compile","message":"invalid syntax","line":3,"column":9}',
    );
    expect(record).toBeDefined();
    expect(isFatal(record!)).toBe(true);
    if (record && isFatal(record)) {
      expect(record.kind).toBe('compile');
      expect(record.line).toBe(3);
      expect(record.column).toBe(9);
    }
  });

  it('accepts a fatal record with null position, which Python may report', () => {
    const [record] = parseResultLines(
      '{"event":"fatal","kind":"load","message":"no Solution","line":null,"column":null}',
    );
    expect(record).toBeDefined();
    expect(isFatal(record!)).toBe(true);
  });

  it('does not mistake a test record for a fatal one', () => {
    const [record] = parseResultLines('{"index":0,"status":"ok"}');
    expect(isFatal(record!)).toBe(false);
  });

  it('reads a mutatedArgs record', () => {
    const [record] = parseResultLines(
      '{"index":0,"status":"ok","mutatedArgs":[{"index":0,"value":[3,1,2]}],"timeMs":1}',
    );
    expect(record).toMatchObject({ mutatedArgs: [{ index: 0, value: [3, 1, 2] }] });
  });

  it('turns a non-finite returned number into an error for that test, not a lost record', () => {
    // What a Python `10**400` becomes: JSON.parse overflows it to Infinity. A
    // dropped record looked like a test the harness never reached (P2-19).
    const [record] = parseResultLines('{"index":0,"status":"ok","returned":1e999,"timeMs":1}');
    expect(record).toMatchObject({
      index: 0,
      status: 'error',
      timeMs: 1,
      error: { type: 'UnreadableResult' },
    });
    expect(record && !isFatal(record) ? record.error?.message : '').toMatch(/too large/);
  });

  it('does the same for a non-finite number in a mutated argument', () => {
    const [record] = parseResultLines(
      '{"index":2,"status":"ok","mutatedArgs":[{"index":1,"value":[1,[2,-1e999]]}]}',
    );
    expect(record).toMatchObject({
      index: 2,
      status: 'error',
      error: { type: 'UnreadableResult' },
    });
    expect(record && !isFatal(record) ? record.error?.message : '').toMatch(/argument 1/);
  });

  it('reports a record that names a test but breaks the schema, saying what broke', () => {
    const [record] = parseResultLines('{"index":3,"status":"finished","timeMs":2}');
    expect(record).toMatchObject({
      index: 3,
      status: 'error',
      error: { type: 'UnreadableResult' },
    });
    expect(record && !isFatal(record) ? record.error?.message : '').toMatch(/status/);
  });
});

describe('parseResults', () => {
  it('notices the ready event, and does not count it as a record', () => {
    const parsed = parseResults('{"event":"ready"}\n{"index":0,"status":"ok"}\n');
    expect(parsed.ready).toBe(true);
    expect(parsed.records).toHaveLength(1);
  });

  it('is not ready when the harness never got that far', () => {
    expect(parseResults('').ready).toBe(false);
    expect(parseResults('{"event":"fatal","kind":"load","message":"x"}').ready).toBe(false);
  });
});

describe('firstNonFinite', () => {
  it('finds a non-finite number at any depth, in lists and objects', () => {
    expect(firstNonFinite(1)).toBe(false);
    expect(firstNonFinite([1, [2, { a: [3, 'x', null, true] }]])).toBe(false);
    expect(firstNonFinite([1, [2, { a: [3, Infinity] }]])).toBe(true);
    expect(firstNonFinite({ deep: -Infinity })).toBe(true);
  });

  it('walks a deeply nested value without recursing', () => {
    let value: unknown = 1;
    for (let i = 0; i < 100_000; i += 1) value = [value];
    expect(firstNonFinite(value)).toBe(false);
  });
});
