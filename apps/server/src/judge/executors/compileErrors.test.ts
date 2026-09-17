import { describe, expect, it } from 'vitest';
import { parseJavacOutput, summariseCompileFailure } from './compileErrors.js';

const MISSING_SEMICOLON = [
  "C:\\work\\abc\\Solution.java:3: error: ';' expected",
  '        int x = 1',
  '                 ^',
  '1 error',
].join('\n');

describe('parseJavacOutput', () => {
  it('extracts line, column and message from a javac diagnostic', () => {
    const { errors } = parseJavacOutput(MISSING_SEMICOLON, 'Solution.java');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      line: 3,
      column: 18,
      severity: 'error',
      message: "';' expected",
    });
  });

  it('handles POSIX paths as well as Windows ones', () => {
    const { errors } = parseJavacOutput(
      '/tmp/abc/Solution.java:12: error: cannot find symbol\n        foo();\n        ^\n',
      'Solution.java',
    );
    expect(errors[0]?.line).toBe(12);
    expect(errors[0]?.message).toBe('cannot find symbol');
  });

  it('reports several diagnostics in order', () => {
    const output = [
      '/x/Solution.java:2: error: first problem',
      '    a',
      '    ^',
      '/x/Solution.java:9: error: second problem',
      '    b',
      '     ^',
      '2 errors',
    ].join('\n');

    const { errors } = parseJavacOutput(output, 'Solution.java');
    expect(errors.map((e) => e.line)).toEqual([2, 9]);
    expect(errors.map((e) => e.column)).toEqual([5, 6]);
  });

  it('separates harness diagnostics from the user\u2019s, so our bug is not blamed on them', () => {
    const output = [
      '/x/Main.java:40: error: something wrong in the harness',
      '    x',
      '    ^',
      '/x/Solution.java:3: error: their mistake',
      '    y',
      '    ^',
    ].join('\n');

    const { errors, harnessErrors } = parseJavacOutput(output, 'Solution.java');
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toBe('their mistake');
    expect(harnessErrors).toHaveLength(1);
    expect(harnessErrors[0]?.message).toBe('something wrong in the harness');
  });

  it('records a warning as a warning', () => {
    const { errors } = parseJavacOutput(
      '/x/Solution.java:4: warning: [unchecked] unchecked cast\n    z\n    ^\n',
      'Solution.java',
    );
    expect(errors[0]?.severity).toBe('warning');
  });

  it('omits the column when javac printed no caret', () => {
    const { errors } = parseJavacOutput(
      '/x/Solution.java:5: error: no caret here\n',
      'Solution.java',
    );
    expect(errors[0]?.line).toBe(5);
    expect(errors[0]?.column).toBeUndefined();
  });

  it('does not borrow the next diagnostic\u2019s caret', () => {
    const output = [
      '/x/Solution.java:1: error: no excerpt',
      '/x/Solution.java:2: error: has an excerpt',
      '    b',
      '      ^',
    ].join('\n');

    const { errors } = parseJavacOutput(output, 'Solution.java');
    expect(errors[0]?.column).toBeUndefined();
    expect(errors[1]?.column).toBe(7);
  });

  it('ignores notes and the summary line', () => {
    const output = [
      'Note: /x/Solution.java uses unchecked or unsafe operations.',
      'Note: Recompile with -Xlint:unchecked for details.',
      '1 error',
    ].join('\n');
    const { errors, harnessErrors } = parseJavacOutput(output, 'Solution.java');
    expect(errors).toEqual([]);
    expect(harnessErrors).toEqual([]);
  });

  it('handles CRLF output', () => {
    const { errors } = parseJavacOutput(MISSING_SEMICOLON.replace(/\n/g, '\r\n'), 'Solution.java');
    expect(errors[0]?.line).toBe(3);
    expect(errors[0]?.column).toBe(18);
  });
});

describe('summariseCompileFailure', () => {
  it('uses the first error message', () => {
    expect(summariseCompileFailure(MISSING_SEMICOLON)).toBe("';' expected");
  });

  it('prefers an error over a warning that came first', () => {
    const output = [
      '/x/Solution.java:1: warning: careful',
      '/x/Solution.java:2: error: the real problem',
    ].join('\n');
    expect(summariseCompileFailure(output)).toBe('the real problem');
  });

  it('falls back to the raw output when nothing parses', () => {
    expect(summariseCompileFailure('javac: file not found\n')).toBe('javac: file not found');
  });

  it('never returns an empty string', () => {
    expect(summariseCompileFailure('   \n')).toBe('compilation failed');
  });
});
