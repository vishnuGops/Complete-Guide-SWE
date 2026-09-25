import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Whether a path survives Windows' ANSI code page (ROADMAP P10-1).
 *
 * Windows gives a JVM its command line, and its own location, in the "ANSI"
 * code page - 1252 on a Western European install, 932 on a Japanese one - and a
 * character that code page has no byte for arrives as `?`. The judge now names
 * every file relative to its workspace, so where `data/` is no longer matters;
 * where the JDK is still does, because the JVM expands its own home and a JDK
 * under `C:\Users\测试\jdk` cannot load `jimage.dll` whatever it is called with,
 * 8.3 names included. The doctor checks the resolved `java` and `javac` with
 * this, the launcher (P10-3) checks the data directory, and the installer
 * (P10-5) uses the same rule for the install directory.
 *
 * `process` is the global, for the reason given at the top of `doctor.ts`.
 */

/** The WHATWG decoder for each Windows ANSI code page a Windows install can have. */
const DECODERS: Readonly<Record<number, string>> = {
  874: 'windows-874',
  932: 'shift_jis',
  936: 'gbk',
  949: 'euc-kr',
  950: 'big5',
  1250: 'windows-1250',
  1251: 'windows-1251',
  1252: 'windows-1252',
  1253: 'windows-1253',
  1254: 'windows-1254',
  1255: 'windows-1255',
  1256: 'windows-1256',
  1257: 'windows-1257',
  1258: 'windows-1258',
};

/** "Beta: Use Unicode UTF-8 for worldwide language support": every path round-trips. */
export const UTF8_CODE_PAGE = 65001;

const DOUBLE_BYTE = new Set([932, 936, 949, 950]);

/** Every character each code page can spell, built the first time it is asked about. */
const repertoires = new Map<number, ReadonlySet<string>>();

function repertoire(codePage: number): ReadonlySet<string> | null {
  const cached = repertoires.get(codePage);
  if (cached) return cached;
  const label = DECODERS[codePage];
  if (label === undefined) return null;

  // Decoding every byte, and every lead-trail pair of a double-byte page, is
  // the whole table: a character is representable exactly when some bytes
  // decode to it. Some 24,000 pairs for GBK, measured at 13 ms.
  const decoder = new TextDecoder(label, { fatal: true });
  const chars = new Set<string>();
  const add = (bytes: Uint8Array): void => {
    try {
      const text = decoder.decode(bytes);
      if ([...text].length === 1) chars.add(text);
    } catch {
      // Not a character in this code page.
    }
  };
  for (let byte = 0; byte <= 0xff; byte += 1) add(Uint8Array.of(byte));
  if (DOUBLE_BYTE.has(codePage)) {
    for (let lead = 0x81; lead <= 0xfe; lead += 1) {
      for (let trail = 0x40; trail <= 0xfe; trail += 1) add(Uint8Array.of(lead, trail));
    }
  }
  repertoires.set(codePage, chars);
  return chars;
}

/**
 * True when every character of `text` has bytes in `codePage`, false when one
 * does not, and null for a code page this does not know - which is not a reason
 * to warn anyone.
 */
export function roundTrips(text: string, codePage: number): boolean | null {
  // ASCII is in every one of them, and is nearly every path there is.
  if ([...text].every((char) => char <= '\x7f')) return true;
  if (codePage === UTF8_CODE_PAGE) return true;
  const chars = repertoire(codePage);
  if (chars === null) return null;
  return [...text].every((char) => chars.has(char));
}

/** The characters of `text` that `codePage` cannot spell, for a message. */
export function unrepresentable(text: string, codePage: number): string[] {
  const chars = repertoire(codePage);
  if (chars === null || codePage === UTF8_CODE_PAGE) return [];
  return [...new Set([...text].filter((char) => char > '\x7f' && !chars.has(char)))];
}

/** `ACP    REG_SZ    1252` out of `reg query`'s answer. */
export function parseAcp(output: string): number | null {
  const match = /\bACP\s+REG_SZ\s+(\d+)/.exec(output);
  return match ? Number(match[1]) : null;
}

let activeCodePage: Promise<number | null> | undefined;

/**
 * The system's ANSI code page, which is what a JVM is handed its arguments in:
 * the registry's value rather than `chcp`'s, which is the console's OEM page.
 * Null off Windows, where paths are bytes and none of this applies, and when
 * the registry cannot be read. Asked once per process.
 */
export function ansiCodePage(): Promise<number | null> {
  if (process.platform !== 'win32') return Promise.resolve(null);
  activeCodePage ??= new Promise((resolve) => {
    const child = spawn(
      'reg',
      ['query', 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Nls\\CodePage', '/v', 'ACP'],
      { shell: false, windowsHide: true },
    );
    let stdout = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.on('error', () => {
      resolve(null);
    });
    child.on('close', () => {
      resolve(parseAcp(stdout));
    });
  });
  return activeCodePage;
}

/**
 * Where `command` would be found - what `spawn` without a shell would start.
 *
 * Only to name the directory in a check: a command given as a path is taken as
 * it is, and a bare name is looked up on `PATH` with Windows' `PATHEXT`. Null
 * when it is not found, which the probe that follows reports in its own words.
 */
export function resolveCommand(
  command: string,
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): string | null {
  const paths = platform === 'win32' ? path.win32 : path.posix;
  if (command.includes('/') || command.includes('\\')) return paths.resolve(command);

  const extensions =
    platform === 'win32'
      ? ['', ...(env['PATHEXT'] ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean)]
      : [''];
  const pathValue = env['PATH'] ?? env['Path'] ?? '';
  for (const dir of pathValue.split(paths.delimiter)) {
    if (dir === '') continue;
    for (const extension of extensions) {
      const candidate = paths.join(dir, `${command}${extension}`);
      try {
        if (fs.statSync(candidate).isFile()) return candidate;
      } catch {
        // Not here.
      }
    }
  }
  return null;
}
