// The judge ships Python and Java harness sources that are written into a
// workspace and executed verbatim. tsc only emits .js, so they have to be copied
// into dist/ alongside it, keeping the same relative layout the executors
// resolve against.
import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const from = path.join(here, '..', 'src', 'judge', 'harness');
const to = path.join(here, '..', 'dist', 'judge', 'harness');

await mkdir(to, { recursive: true });
await cp(from, to, { recursive: true });
console.log(`copied judge harness -> ${path.relative(process.cwd(), to)}`);
