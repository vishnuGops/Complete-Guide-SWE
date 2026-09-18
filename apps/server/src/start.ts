/**
 * The production entry point (ROADMAP P3-6, D24).
 *
 * Two lines, and both of them earn their file.
 *
 * `NODE_ENV` has to be set *before* anything is imported: `logger.ts` reads it
 * at module load to decide whether to load `pino-pretty`, which is a
 * devDependency - so a production install that imported the server directly
 * crashed on a missing module, and one that did not crash was logging through a
 * pretty-printer it did not need. Doing it here rather than in the npm script
 * keeps `npm start` working the same way in PowerShell, cmd and a POSIX shell,
 * none of which agree on how to set a variable for one command.
 *
 * The import is dynamic for the same reason: a static one is hoisted above the
 * assignment.
 */
process.env.NODE_ENV ??= 'production';

const { start } = await import('./index.js');

/*
 * Called rather than left to the module's own entry-point check: that check
 * compares `process.argv[1]` with `index.js`, and here `argv[1]` is this file.
 * The first version of this launcher relied on it, built everything, started
 * nothing, and exited 0.
 */
await start().catch((error: unknown) => {
  // No stack for a message meant for a person - a port already in use is not a
  // crash, it is a thing to go and fix.
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(['', `DevProMax could not start: ${message}`, '', ''].join('\n'));
  process.exitCode = 1;
});
