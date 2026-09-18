#!/usr/bin/env node
/**
 * The flake budget (ROADMAP P8-1).
 *
 * CI retries a failing test twice, which is the right trade for a suite that
 * spawns interpreters and drives a browser: a genuinely flaky test should not
 * turn every pull request red. What it must not do is turn flakiness into
 * something nobody sees. So the retries are counted, and more than a couple of
 * them fails the job on purpose.
 *
 * "Flaky" here means what Playwright means by it: the test failed at least once
 * and then passed on a retry. A test that failed every attempt is not flaky, it
 * is broken, and the run has already failed for that.
 *
 * Reads the JSON reporter's output, which only CI writes. Outside CI there are
 * no retries to count and this exits quietly.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

/**
 * How many flaky tests a run may have before the job fails.
 *
 * Two, not zero. Zero would mean a single hiccup on a shared CI runner blocks
 * a merge, and the suite would then grow `test.skip`s instead of getting more
 * reliable - which is the outcome this is trying to avoid. Two is small enough
 * that a real regression in reliability trips it within a day.
 */
const BUDGET = 2;

const REPORT = path.resolve(process.argv[2] ?? 'playwright-report/results.json');

if (!fs.existsSync(REPORT)) {
  // Not an error: the JSON reporter is CI-only, and a local run has nothing to
  // report on because `retries` is 0 there.
  console.log(`flake budget: no report at ${REPORT}; nothing to check.`);
  process.exit(0);
}

/** Every test, flattened out of the suite tree the reporter writes. */
function* tests(suite) {
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      yield { title: [...(spec.file ? [spec.file] : []), spec.title].join(' › '), test };
    }
  }
  for (const child of suite.suites ?? []) yield* tests(child);
}

const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
const flaky = [];
for (const suite of report.suites ?? []) {
  for (const { title, test } of tests(suite)) {
    // The reporter says `flaky` itself, having watched the retries; deriving it
    // from the result list again would be a second opinion that can disagree.
    if (test.status === 'flaky') {
      flaky.push(
        `${title} (${String((test.results ?? []).length - 1)} retr${(test.results ?? []).length - 1 === 1 ? 'y' : 'ies'})`,
      );
    }
  }
}

if (flaky.length === 0) {
  console.log('flake budget: no test needed a retry.');
  process.exit(0);
}

console.log(`flake budget: ${String(flaky.length)} of ${String(BUDGET)} used`);
for (const entry of flaky) console.log(`  - ${entry}`);

if (flaky.length > BUDGET) {
  console.error(
    `\nflake budget exceeded: ${String(flaky.length)} tests passed only on a retry (budget ${String(BUDGET)}).`,
  );
  console.error('Fix the flakiest one rather than raising this number.');
  process.exit(1);
}
