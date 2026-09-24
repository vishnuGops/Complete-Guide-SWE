#!/usr/bin/env tsx
/**
 * `npm run problems:schema` — regenerates docs/schema/*.schema.json from the zod
 * schemas in @devpromax/shared.
 *
 * The JSON Schema files exist so editors can complete and check `meta.json`,
 * `tests.json` and `hints.json` while a problem is being authored. They are
 * generated, never hand-edited: zod stays the single source of truth and the two
 * cannot drift. CI re-runs this and fails if the checked-in files differ.
 */
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { hintsFileSchema, problemMetaSchema, testsFileSchema } from '@devpromax/shared';
import { paths } from '../../config.js';

const OUT_DIR = path.join(paths.repoRoot, 'docs', 'schema');

const TARGETS = [
  {
    file: 'meta.schema.json',
    title: 'DevProMax problem meta.json',
    schema: problemMetaSchema,
  },
  {
    file: 'tests.schema.json',
    title: 'DevProMax problem tests.json',
    schema: testsFileSchema,
  },
  {
    file: 'hints.schema.json',
    title: 'DevProMax problem hints.json',
    schema: hintsFileSchema,
  },
] as const;

function render(title: string, schema: z.ZodType): string {
  const json = z.toJSONSchema(schema, {
    // Author-facing: describe what a hand-written file may contain, before
    // defaults are applied.
    io: 'input',
    unrepresentable: 'any',
  }) as Record<string, unknown>;
  const withTitle = { $schema: 'https://json-schema.org/draft/2020-12/schema', title, ...json };
  return `${JSON.stringify(withTitle, null, 2)}\n`;
}

export function generateSchemas(): Map<string, string> {
  const out = new Map<string, string>();
  for (const target of TARGETS) {
    out.set(target.file, render(target.title, target.schema));
  }
  return out;
}

function main(): void {
  const check = process.argv.includes('--check');
  const generated = generateSchemas();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let stale = 0;
  for (const [file, contents] of generated) {
    const dest = path.join(OUT_DIR, file);
    const existing = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : null;
    if (existing === contents) continue;
    if (check) {
      console.error(`stale: docs/schema/${file}`);
      stale += 1;
    } else {
      fs.writeFileSync(dest, contents, 'utf8');
      console.log(`wrote docs/schema/${file}`);
    }
  }

  if (check) {
    if (stale > 0) {
      console.error(`\n${stale} schema file(s) out of date. Run: npm run problems:schema`);
      process.exit(1);
    }
    console.log('docs/schema is up to date.');
  }
}

main();
