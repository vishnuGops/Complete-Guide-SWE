// tsc only emits .js, so the non-TypeScript files the server reads at runtime
// have to be copied into dist/ keeping the same relative layout the code
// resolves against:
//
//   judge/harness      - Python and Java sources written into a workspace and
//                        run verbatim.
//   problems/generator - the Python runner that drives a problem's generator.py.
//   db/migrations      - the checked-in SQL applied at startup.
//   coach/prompts      - the versioned system prompt sent to the provider.
import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

const assets = [
  ['judge', 'harness'],
  ['problems', 'generator'],
  ['db', 'migrations'],
  ['coach', 'prompts'],
];

// `coach/prompts` mixes prose with a loader module, and tsc has already emitted
// the loader. Copying the .ts source next to its own .js output would put two
// spellings of the same module in dist/, so TypeScript is filtered out here
// rather than by splitting the prompts into a directory that holds only prose.
const isNotTypeScript = (src) => !src.endsWith('.ts');

for (const parts of assets) {
  const from = path.join(here, '..', 'src', ...parts);
  const to = path.join(here, '..', 'dist', ...parts);
  await mkdir(to, { recursive: true });
  await cp(from, to, { recursive: true, filter: isNotTypeScript });
  console.log(`copied ${parts.join('/')} -> ${path.relative(process.cwd(), to)}`);
}
