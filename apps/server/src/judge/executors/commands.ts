/**
 * The three executables the judge shells out to.
 *
 * Their own module, tiny and importing nothing, so that something which only
 * needs to know *which* command would be run - the first-run doctor (ROADMAP
 * P8-3) - does not have to pull the executors, the harness protocol and the
 * process machinery in behind them. A diagnostic that drags the judge into its
 * import graph is a diagnostic that cannot run when the judge is the problem.
 *
 * Each can be overridden, which is the answer for a machine with three JDKs, or
 * with Windows' Microsoft Store alias sitting on `python`.
 */
export const PYTHON_COMMAND = process.env['DEVPROMAX_PYTHON'] ?? 'python';
export const JAVAC_COMMAND = process.env['DEVPROMAX_JAVAC'] ?? 'javac';
export const JAVA_COMMAND = process.env['DEVPROMAX_JAVA'] ?? 'java';
