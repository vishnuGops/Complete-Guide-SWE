import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { parseAcp, resolveCommand, roundTrips, unrepresentable } from './codePage.js';

/**
 * The ANSI code-page rule (ROADMAP P10-1): which paths a JVM on Windows can be
 * handed. Pure, so it runs on every platform.
 */

describe('roundTrips', () => {
  it('passes plain ASCII in every code page, known or not', () => {
    expect(roundTrips('C:\\Program Files\\Eclipse Adoptium\\jdk-25\\bin\\java.exe', 1252)).toBe(
      true,
    );
    expect(roundTrips('C:\\Java\\bin\\java.exe', 12345)).toBe(true);
  });

  it('passes the accented Latin a Western code page has', () => {
    expect(roundTrips('C:\\Users\\José Müller\\jdk', 1252)).toBe(true);
  });

  it('fails what the code page has no byte for', () => {
    // The case reproduced on the home server: a cp1252 machine and a folder
    // named in Chinese.
    expect(roundTrips('C:\\Users\\测试\\jdk', 1252)).toBe(false);
    // And the reverse: Polish is Central European, not Western.
    expect(roundTrips('C:\\Users\\Łukasz\\jdk', 1252)).toBe(false);
    expect(roundTrips('C:\\Users\\Łukasz\\jdk', 1250)).toBe(true);
  });

  it('passes each script in its own double-byte code page', () => {
    expect(roundTrips('C:\\Users\\测试\\jdk', 936)).toBe(true);
    expect(roundTrips('C:\\ユーザー\\テスト', 932)).toBe(true);
    expect(roundTrips('C:\\사용자\\jdk', 949)).toBe(true);
    // An emoji is in none of them.
    expect(roundTrips('C:\\jdk 🙂', 936)).toBe(false);
  });

  it('passes everything under the UTF-8 code page', () => {
    expect(roundTrips('C:\\Users\\测试 🙂\\jdk', 65001)).toBe(true);
  });

  it('does not guess about a code page it does not know', () => {
    expect(roundTrips('C:\\Users\\测试', 12345)).toBeNull();
  });
});

describe('unrepresentable', () => {
  it('names each character the message should point at, once', () => {
    expect(unrepresentable('C:\\测试\\测试\\José', 1252)).toEqual(['测', '试']);
    expect(unrepresentable('C:\\Java', 1252)).toEqual([]);
  });
});

describe('parseAcp', () => {
  it("reads the code page out of reg query's answer", () => {
    const output = [
      '',
      'HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Nls\\CodePage',
      '    ACP    REG_SZ    1252',
      '',
    ].join('\r\n');
    expect(parseAcp(output)).toBe(1252);
    expect(parseAcp('ERROR: The system was unable to find the specified registry key.')).toBeNull();
  });
});

describe('resolveCommand', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'devpromax-resolve-'));
  const name = process.platform === 'win32' ? 'fake-java.EXE' : 'fake-java';
  fs.writeFileSync(path.join(dir, name), '');

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('finds a bare name on PATH the way spawn would, extensions included', () => {
    const env = { PATH: [path.join(dir, 'missing'), dir].join(path.delimiter), PATHEXT: '.EXE' };
    expect(resolveCommand('fake-java', env)).toBe(path.join(dir, name));
  });

  it('takes a path as given, and reports a name nowhere on PATH as not found', () => {
    expect(resolveCommand(path.join(dir, name), { PATH: '' })).toBe(path.join(dir, name));
    expect(resolveCommand('fake-java', { PATH: path.join(dir, 'missing') })).toBeNull();
  });
});
