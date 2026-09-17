import { describe, expect, it } from 'vitest';
import { isFatal, parseResultLines } from './protocol.js';

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

  it('rejects a record carrying a non-finite number, which JSON cannot express', () => {
    expect(parseResultLines('{"index":0,"status":"ok","returned":1e999,"timeMs":1}')).toEqual([]);
  });
});
