#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { repoRoot } from '../config.js';
import {
  MINIMUM_JAVA,
  MINIMUM_PYTHON,
  parseJavaVersion,
  parsePythonVersion,
} from '../toolchain/doctor.js';
import { readVersion } from '../version.js';
import {
  bundleRefusals,
  shipsBuildFile,
  shipsDependencyFile,
  shipsProblemFile,
} from './bundleRules.js';

/**
 * `npm run package:win` (ROADMAP P10-4, D26): a folder that runs DevProMax on
 * a Windows machine with nothing installed.
 *
 *     release/DevProMax-<version>-win-x64/
 *       DevProMax.cmd              the launcher, for the portable folder
 *       package.json               the version, which the server reads
 *       apps/server/dist, apps/web/dist, problems/   the repository's layout,
 *                                  because config.ts finds everything from dist/
 *       node_modules/              the server's production dependencies
 *       runtime/node/node.exe      Node, nothing else from its archive
 *       runtime/python/            python-build-standalone, trimmed
 *       runtime/jdk/               Temurin cut down by jlink
 *
 * Downloads are pinned in `installer/runtimes.json` and cached in
 * `release/.cache`; a hash that does not match stops the build. Then the bundle
 * is checked for what must never be in it, and its own doctor has to pass with
 * nothing but Windows on `PATH`.
 */

const PLATFORM = 'win-x64';

interface Pin {
  version: string;
  url: string;
  sha256: string;
}
type Pins = Record<'node' | 'python' | 'jdk', Pin>;

/**
 * Parts of python-build-standalone nobody running a judge needs: the GUI
 * toolkit and its demos, the interpreter's own test suite, and the machinery
 * for installing packages, which a user of the bundle never does.
 */
const PYTHON_TRIM = [
  'Lib/tkinter',
  'Lib/idlelib',
  'Lib/turtledemo',
  'Lib/test',
  'Lib/ensurepip',
  'Lib/turtle.py',
  'tcl',
  'DLLs/_tkinter.pyd',
  'DLLs/tcl86t.dll',
  'DLLs/tk86t.dll',
  'Scripts',
];

/**
 * `java.base` is everything the harness imports and `jdk.compiler` is javac. A
 * solution that imports outside them gets a compile error, as it would on
 * LeetCode; add a module only with a test that needs it.
 */
const JLINK_MODULES = ['java.base', 'jdk.compiler'];

const args = process.argv.slice(2);
if (args.includes('--platform') && args[args.indexOf('--platform') + 1] !== PLATFORM) {
  fail(`Only ${PLATFORM} is packaged so far (Linux is ROADMAP P10-9).`);
}

const version = readVersion();
const release = path.join(repoRoot, 'release');
const cache = path.join(release, '.cache');
const out = path.join(release, `DevProMax-${version}-${PLATFORM}`);
const stage = path.join(release, '.stage');

function fail(message: string): never {
  process.stderr.write(`\npackage: ${message}\n`);
  process.exit(1);
}

function step(message: string): void {
  process.stdout.write(`\n== ${message}\n`);
}

/** Runs a program to completion with its output shown; no shell. */
function run(
  command: string,
  commandArgs: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): void {
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd ?? repoRoot,
    env: options.env ?? process.env,
    stdio: 'inherit',
    shell: false,
  });
  if (result.error) fail(`${command} could not be started: ${result.error.message}`);
  if (result.status !== 0)
    fail(`${command} ${commandArgs.join(' ')} exited ${String(result.status)}`);
}

/** Output of a program, for a version check. */
function capture(command: string, commandArgs: string[], env?: NodeJS.ProcessEnv): string {
  const result = spawnSync(command, commandArgs, { encoding: 'utf8', shell: false, env });
  if (result.error) fail(`${command} could not be started: ${result.error.message}`);
  return `${result.stdout}\n${result.stderr}`;
}

/** npm, the one that is running this script. On Windows it is a .cmd, which cannot be spawned without a shell. */
function npm(npmArgs: string[], cwd = repoRoot): void {
  const cli = process.env['npm_execpath'];
  if (cli === undefined) fail('run this through npm: npm run package:win');
  run(process.execPath, [cli, ...npmArgs], { cwd });
}

/** Windows' own bsdtar, which reads zip as well as tar; Git's GNU tar on PATH reads neither the same way. */
function extract(archive: string, into: string): void {
  fs.mkdirSync(into, { recursive: true });
  const tar =
    process.platform === 'win32'
      ? path.join(process.env['SystemRoot'] ?? 'C:\\Windows', 'System32', 'tar.exe')
      : 'tar';
  run(tar, ['-xf', archive, '-C', into]);
}

async function sha256(file: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

/** The pinned file, from the cache or downloaded into it, checked either way. */
async function fetchPinned(name: string, pin: Pin): Promise<string> {
  fs.mkdirSync(cache, { recursive: true });
  const file = path.join(cache, decodeURIComponent(path.basename(new URL(pin.url).pathname)));
  if (!fs.existsSync(file)) {
    process.stdout.write(`downloading ${name} ${pin.version}\n`);
    const response = await fetch(pin.url);
    if (!response.ok || response.body === null)
      fail(`${pin.url} answered ${String(response.status)}`);
    const partial = `${file}.partial`;
    fs.writeFileSync(partial, Buffer.from(await response.arrayBuffer()));
    fs.renameSync(partial, file);
  }
  const actual = await sha256(file);
  if (actual !== pin.sha256) {
    fs.rmSync(file, { force: true });
    fail(
      `${name}: ${path.basename(file)} has SHA-256 ${actual}, but runtimes.json pins ${pin.sha256}. The cached copy was removed; if the pin is wrong, fix runtimes.json.`,
    );
  }
  return file;
}

/** Copies a tree, keeping what `keep` accepts. */
function copyTree(from: string, to: string, keep: (file: string) => boolean = () => true): void {
  fs.cpSync(from, to, {
    recursive: true,
    filter: (source) => fs.statSync(source).isDirectory() || keep(source),
  });
}

/** The only directory in `dir`: an archive's single top-level folder. */
function onlyChild(dir: string): string {
  const entries = fs.readdirSync(dir);
  if (entries.length !== 1) fail(`expected one folder in ${dir}, found ${entries.join(', ')}`);
  return path.join(dir, entries[0]!);
}

function sizeOf(target: string): number {
  const stat = fs.lstatSync(target);
  if (!stat.isDirectory()) return stat.size;
  return fs
    .readdirSync(target)
    .reduce((total, entry) => total + sizeOf(path.join(target, entry)), 0);
}

function megabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------

const pins = (
  JSON.parse(fs.readFileSync(path.join(repoRoot, 'installer', 'runtimes.json'), 'utf8')) as Record<
    string,
    Pins
  >
)[PLATFORM];
if (pins === undefined) fail(`installer/runtimes.json has no ${PLATFORM} entry`);

fs.rmSync(out, { recursive: true, force: true });
fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

step('building the app from clean');
// Stale output from a moved file would otherwise ship: tsc never deletes.
for (const dist of ['packages/shared/dist', 'apps/server/dist', 'apps/web/dist']) {
  fs.rmSync(path.join(repoRoot, dist), { recursive: true, force: true });
}
npm(['run', 'build']);

step('runtimes');
const runtime = path.join(out, 'runtime');

const nodeExe = await fetchPinned('node', pins.node);
fs.mkdirSync(path.join(runtime, 'node'), { recursive: true });
fs.copyFileSync(nodeExe, path.join(runtime, 'node', 'node.exe'));

const pythonArchive = await fetchPinned('python', pins.python);
extract(pythonArchive, path.join(stage, 'python'));
fs.renameSync(onlyChild(path.join(stage, 'python')), path.join(runtime, 'python'));
for (const part of PYTHON_TRIM) {
  fs.rmSync(path.join(runtime, 'python', part), { recursive: true, force: true });
}
for (const entry of fs.readdirSync(path.join(runtime, 'python', 'Lib', 'site-packages'))) {
  if (entry.startsWith('pip')) {
    fs.rmSync(path.join(runtime, 'python', 'Lib', 'site-packages', entry), {
      recursive: true,
      force: true,
    });
  }
}

const jdkArchive = await fetchPinned('jdk', pins.jdk);
extract(jdkArchive, path.join(stage, 'jdk'));
const fullJdk = onlyChild(path.join(stage, 'jdk'));
run(path.join(fullJdk, 'bin', 'jlink.exe'), [
  '--add-modules',
  JLINK_MODULES.join(','),
  '--strip-debug',
  '--no-man-pages',
  '--no-header-files',
  // A class-data-sharing archive: a JVM that starts faster on a slow machine,
  // which is every Run.
  '--generate-cds-archive',
  '--output',
  path.join(runtime, 'jdk'),
]);
// The archive for heaps past 32 GB, where compressed pointers are off. The
// judge's JVMs run at -Xmx256m and javac's at a quarter of RAM, so it would
// take a machine with 128 GB to load it: 14 MB for nobody. Measured on the home
// server, the archive that stays takes javac's start from 362 ms to 235 ms.
fs.rmSync(path.join(runtime, 'jdk', 'bin', 'server', 'classes_nocoops.jsa'), { force: true });

step('the app');
const packageJson = { name: 'devpromax', version, private: true, type: 'module' };
fs.writeFileSync(path.join(out, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);

const notShipped = shipsBuildFile;
copyTree(
  path.join(repoRoot, 'apps', 'server', 'dist'),
  path.join(out, 'apps', 'server', 'dist'),
  notShipped,
);
fs.copyFileSync(
  path.join(repoRoot, 'apps', 'server', 'package.json'),
  path.join(out, 'apps', 'server', 'package.json'),
);
copyTree(
  path.join(repoRoot, 'apps', 'web', 'dist'),
  path.join(out, 'apps', 'web', 'dist'),
  notShipped,
);

// Only what the loader reads: generator.py, bytecode and the generator's
// version stamp stay behind.
copyTree(path.join(repoRoot, 'problems'), path.join(out, 'problems'), shipsProblemFile);

step('production dependencies');
// A staging copy of the workspace manifests and the lockfile, so `npm ci`
// installs exactly the locked versions of the server's dependencies and
// nothing of the web app's or of the dev tooling.
for (const manifest of [
  'package.json',
  'package-lock.json',
  'apps/server/package.json',
  'apps/web/package.json',
  'packages/shared/package.json',
]) {
  const target = path.join(stage, 'npm', manifest);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(repoRoot, manifest), target);
}
npm(
  [
    'ci',
    '--omit=dev',
    '--workspace',
    '@devpromax/server',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
  ],
  path.join(stage, 'npm'),
);
const stagedModules = path.join(stage, 'npm', 'node_modules');
// The workspace links: an installer does not carry symlinks, and only the
// shared package is a runtime dependency. It goes in as a real copy.
fs.rmSync(path.join(stagedModules, '@devpromax'), { recursive: true, force: true });
fs.rmSync(path.join(stagedModules, '.package-lock.json'), { force: true });
// Command shims for packages' own CLIs, which nothing in the bundle runs.
fs.rmSync(path.join(stagedModules, '.bin'), { recursive: true, force: true });
copyTree(stagedModules, path.join(out, 'node_modules'), shipsDependencyFile);
const nested = path.join(stage, 'npm', 'apps', 'server', 'node_modules');
if (fs.existsSync(nested)) {
  copyTree(nested, path.join(out, 'apps', 'server', 'node_modules'), shipsDependencyFile);
}
const shared = path.join(out, 'node_modules', '@devpromax', 'shared');
fs.mkdirSync(shared, { recursive: true });
fs.copyFileSync(
  path.join(repoRoot, 'packages', 'shared', 'package.json'),
  path.join(shared, 'package.json'),
);
copyTree(path.join(repoRoot, 'packages', 'shared', 'dist'), path.join(shared, 'dist'), notShipped);

// The portable folder's front door. The installer's shortcuts (P10-5) start
// node.exe directly; this is for someone who unzipped the folder instead.
fs.writeFileSync(
  path.join(out, 'DevProMax.cmd'),
  [
    '@echo off',
    '"%~dp0runtime\\node\\node.exe" "%~dp0apps\\server\\dist\\launch\\main.js" %*',
    '',
  ].join('\r\n'),
);
fs.rmSync(stage, { recursive: true, force: true });

step('checking the bundle');
const refused = bundleRefusals(out);
if (refused.length > 0) fail(`the bundle contains what it must not:\n  ${refused.join('\n  ')}`);

const bundledPython = path.join(runtime, 'python', 'python.exe');
const python = parsePythonVersion(capture(bundledPython, ['--version']));
if (
  python === null ||
  python.major < MINIMUM_PYTHON.major ||
  (python.major === MINIMUM_PYTHON.major && python.minor < MINIMUM_PYTHON.minor)
) {
  fail(
    `the bundled Python is ${python === null ? 'not answering' : `${String(python.major)}.${String(python.minor)}`}; the harness needs 3.10`,
  );
}
const java = parseJavaVersion(capture(path.join(runtime, 'jdk', 'bin', 'java.exe'), ['-version']));
if (java === null || java < MINIMUM_JAVA)
  fail(`the bundled Java is ${String(java)}; the starters need ${String(MINIMUM_JAVA)}`);

// The doctor, from the bundle, on a PATH with nothing but Windows on it and
// every DEVPROMAX_ variable gone: a launcher that fell back to this machine's
// runtimes would pass here only if the bundle's were also fine.
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'devpromax-package-'));
const systemRoot = process.env['SystemRoot'] ?? 'C:\\Windows';
const bare: NodeJS.ProcessEnv = {
  SystemRoot: systemRoot,
  SystemDrive: process.env['SystemDrive'] ?? 'C:',
  WINDIR: systemRoot,
  PATH: [path.join(systemRoot, 'System32'), systemRoot].join(';'),
  PATHEXT: '.COM;.EXE;.BAT;.CMD',
  TEMP: scratch,
  TMP: scratch,
  USERPROFILE: scratch,
  LOCALAPPDATA: scratch,
};
const doctor = await new Promise<number | null>((resolve) => {
  const child = spawn(
    path.join(runtime, 'node', 'node.exe'),
    [path.join(out, 'apps', 'server', 'dist', 'launch', 'main.js'), 'doctor'],
    {
      env: bare,
      stdio: 'inherit',
    },
  );
  child.once('exit', resolve);
});
fs.rmSync(scratch, { recursive: true, force: true });
if (doctor !== 0) fail('the bundled doctor is not green with only the bundle to go on');

step('sizes');
const parts: [string, string][] = [
  ['runtime/node', path.join(runtime, 'node')],
  ['runtime/python', path.join(runtime, 'python')],
  ['runtime/jdk', path.join(runtime, 'jdk')],
  ['problems', path.join(out, 'problems')],
  ['node_modules', path.join(out, 'node_modules')],
  ['apps', path.join(out, 'apps')],
];
for (const [name, dir] of parts)
  process.stdout.write(`  ${name.padEnd(16)} ${megabytes(sizeOf(dir)).padStart(10)}\n`);
process.stdout.write(`  ${'total'.padEnd(16)} ${megabytes(sizeOf(out)).padStart(10)}\n`);
process.stdout.write(`\nDevProMax ${version} is in ${out}\n`);
