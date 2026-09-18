import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Builds throwaway problem catalogues on disk for the validator tests.
 *
 * Tests start from a package that passes every rule and break exactly one thing,
 * so a failing assertion names the rule it is about. Checking in a directory per
 * broken case would be far more files and would drift from the valid baseline.
 */

export interface FileOverrides {
  [file: string]: string | null;
}

const VALID_META = {
  id: 'pair-sum-index',
  slug: 'pair-sum-index',
  title: 'Pair Sum Index',
  version: 1,
  topic: 'arrays',
  patterns: ['hash map'],
  tier: 'Easy',
  rating: 2,
  order: 0,
  mode: 'function',
  entry: 'pairSumIndex',
  expect: 'return',
  comparator: 'exact',
  targetComplexity: { time: 'O(n)', space: 'O(n)' },
};

function makeTests(sampleCount = 3, hiddenCount = 10) {
  const samples = Array.from({ length: sampleCount }, (_, i) => ({
    args: [[1, 2, 3 + i], 3 + i + 1],
    expected: [0, 2],
    explanation: `Sample ${i + 1}.`,
  }));
  const hidden = Array.from({ length: hiddenCount }, (_, i) => ({
    args: [[i, i + 1], 2 * i + 1],
    expected: [0, 1],
  }));
  return { samples, hidden };
}

function makeStatement(exampleCount = 3): string {
  const examples = Array.from(
    { length: exampleCount },
    (_, i) =>
      // A blank line between Input and Output, or markdown renders them as one
      // paragraph and the P6-0 check rejects it - as it should.
      `### Example ${i + 1}\n\nInput: \`nums = [1, 2, 3]\`, \`target = 4\`\n\nOutput: \`[0, 2]\`\n`,
  ).join('\n');
  return [
    'You are given a list of integers and a target.',
    '',
    '## Input',
    '',
    '- `nums` — list of integers',
    '- `target` — integer',
    '',
    '## Output',
    '',
    'The two indices whose values sum to the target.',
    '',
    '## Constraints',
    '',
    // Small enough that the fixture's own two-element tests reach it, so the
    // D21 check passes on a fixture that is not pretending to be a real
    // problem (P6-0).
    '- `2 <= nums.length <= 3`',
    '',
    '## Examples',
    '',
    examples,
  ].join('\n');
}

const VALID_FILES: Record<string, string> = {
  'meta.json': `${JSON.stringify(VALID_META, null, 2)}\n`,
  'tests.json': `${JSON.stringify(makeTests(), null, 2)}\n`,
  // Four rungs, because that is the ladder the format asks for (P6-0).
  'hints.json': `${JSON.stringify(
    {
      hints: [
        'Look again at what you have already walked past.',
        'A hash map from value to index answers "have I seen the complement" in constant time.',
        'Scan once, checking for the complement before inserting the current value.',
        'Insert after checking, so a value cannot pair with itself.',
      ],
    },
    null,
    2,
  )}\n`,
  'statement.md': makeStatement(),
  'editorial.md': '## Approach\n\nOne pass with a hash map.\n\n## Complexity\n\n- Time: `O(n)`\n',
  'starter.py':
    'from typing import List\n\n\nclass Solution:\n    def pairSumIndex(self, nums: List[int], target: int) -> List[int]:\n        pass\n',
  'reference.py':
    'from typing import List\n\n\nclass Solution:\n    def pairSumIndex(self, nums: List[int], target: int) -> List[int]:\n        seen = {}\n        for i, v in enumerate(nums):\n            if target - v in seen:\n                return [seen[target - v], i]\n            seen[v] = i\n        return []\n',
  'starter.java':
    'import java.util.*;\n\nclass Solution {\n    public int[] pairSumIndex(int[] nums, int target) {\n        return null;\n    }\n}\n',
  'reference.java':
    'import java.util.*;\n\nclass Solution {\n    public int[] pairSumIndex(int[] nums, int target) {\n        Map<Integer, Integer> seen = new HashMap<>();\n        for (int i = 0; i < nums.length; i++) {\n            Integer j = seen.get(target - nums[i]);\n            if (j != null) return new int[] { j, i };\n            seen.put(nums[i], i);\n        }\n        return new int[0];\n    }\n}\n',
  'generator.py':
    'import random\n\n\ndef generate(rng: random.Random):\n    yield {"args": [[1, 2], 3]}\n',
};

export { VALID_META, makeTests, makeStatement };

/** Writes one problem directory. `null` in overrides deletes that file. */
export function writeProblem(
  root: string,
  opts: { topic?: string; slug?: string; files?: FileOverrides } = {},
): string {
  const topic = opts.topic ?? 'arrays';
  const slug = opts.slug ?? 'pair-sum-index';
  const dir = path.join(root, topic, slug);
  fs.mkdirSync(dir, { recursive: true });

  const files: FileOverrides = { ...VALID_FILES, ...(opts.files ?? {}) };
  for (const [name, contents] of Object.entries(files)) {
    const full = path.join(dir, name);
    if (contents === null) {
      if (fs.existsSync(full)) fs.rmSync(full);
      continue;
    }
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, contents, 'utf8');
  }
  return dir;
}

/** Creates a temp catalogue root; the caller removes it. */
export function makeCatalogue(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'devpromax-problems-'));
}

/** Convenience: a catalogue holding a single valid problem, with overrides applied. */
export function catalogueWith(opts: Parameters<typeof writeProblem>[1] = {}): string {
  const root = makeCatalogue();
  writeProblem(root, opts);
  return root;
}

/** Serialises an object as a problem file body. */
export function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
