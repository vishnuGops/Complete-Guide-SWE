#!/usr/bin/env node
import { doctorSummary, runDoctor } from '../doctor.js';
import { formatters } from '../formatters.js';

/**
 * `npm run doctor` (ROADMAP P8-3).
 *
 * The same check the server runs at start-up and the same one Settings shows,
 * runnable on its own - which is what someone wants when they are in the middle
 * of installing a JDK and would like to know whether it worked.
 *
 * Prints every runtime, not only the broken ones. The start-up summary stays
 * quiet when all is well because nobody reads a start-up that always talks;
 * this was asked for, so it answers in full.
 */
const report = await runDoctor();

process.stdout.write(
  report.executor === 'docker'
    ? '  The judge runs in Docker (DEVPROMAX_EXECUTOR=docker).\n\n'
    : '  The judge runs on this machine.\n\n',
);

for (const check of report.checks) {
  const state = check.ok ? 'ok  ' : 'FAIL';
  const version = check.version === null ? 'no version' : check.version;
  process.stdout.write(
    `  ${state} ${check.name.padEnd(7)} ${version.padEnd(12)} ${check.command}\n`,
  );
  if (!check.ok) {
    if (check.problem !== null) process.stdout.write(`       ${check.problem}\n`);
    if (check.guidance !== null) process.stdout.write(`       ${check.guidance}\n`);
  }
}

/*
 * The formatters (ROADMAP P9-5). Optional, so a missing one is "--" and never
 * the exit code: the judge works without them, and this command's exit code
 * answers "will the judge work".
 */
process.stdout.write('\n  Optional, for Format on save:\n');
for (const status of await formatters.status()) {
  const state = status.available ? 'ok  ' : '--  ';
  const version = status.version ?? 'not found';
  process.stdout.write(
    `  ${state} ${status.name.padEnd(18)} ${version.padEnd(12)} ${status.command}\n`,
  );
  if (status.guidance !== null) process.stdout.write(`       ${status.guidance}\n`);
}

if (report.ok) {
  process.stdout.write(
    report.executor === 'docker'
      ? '\nDocker is running and both images are here; the judge will work.\n'
      : '\nBoth runtimes are usable; the judge will work.\n',
  );
} else {
  process.stdout.write(`${doctorSummary(report) ?? ''}`);
  process.exitCode = 1;
}
