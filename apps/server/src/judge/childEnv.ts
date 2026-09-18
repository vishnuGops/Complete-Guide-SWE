/**
 * The environment a judge child is allowed to see (ROADMAP P2-11, D15).
 *
 * The defect this file closes: every judge child used to be spawned with
 * `process.env`, so
 *
 *     print(os.environ["COACH_API_KEY"])
 *
 * put the user's own API key on stdout, which the run result carries and the
 * results panel renders. The key is the one secret this app holds, and
 * CLAUDE.md says it is never logged and never exported; a `print` away from the
 * screen is neither.
 *
 * So the child environment is built from an allow-list rather than filtered.
 * That direction matters more than the list does: a deny-list is wrong the day
 * someone adds a variable and forgets to deny it, and the thing forgotten is by
 * definition the new secret. Nothing here spreads `process.env`.
 *
 * What is on the list is what an interpreter needs to start at all:
 *
 *   - `PATH` - how `python` and `java` are found when they came from PATH; on
 *     Windows also `PATHEXT`, or `python` resolves to a name with no extension.
 *   - `SYSTEMROOT`, `SYSTEMDRIVE`, `WINDIR`, `COMSPEC` - the JVM loads Winsock
 *     and other system DLLs relative to these; without `SYSTEMROOT` `java`
 *     fails before `main` with a socket-initialisation error.
 *   - `TEMP`, `TMP` - both runtimes want somewhere to write. The judge gives the
 *     child a workspace, but the JVM's own perf-data file is not in it.
 *   - `USERPROFILE`, `HOME` - `java` warns without one and some libraries throw.
 *   - `JAVA_HOME` - how a `javac` shim finds its JDK.
 *   - `LANG`, `LC_ALL`, `LC_CTYPE`, `PYTHONIOENCODING`, `TZ` - text and time
 *     behaviour, so a run is reproducible for the user who is watching it.
 *
 * Deliberately not on the list: anything `DEVPROMAX_*`, `COACH_API_KEY`,
 * `NODE_*`, `npm_*`, `CI`, proxy settings, `AWS_*`, `GITHUB_*`, and everything
 * else a developer's shell happens to be carrying.
 */

/**
 * Compared case-insensitively.
 *
 * Windows environment names are case-insensitive but `process.env` keeps
 * whatever case the parent used - `Path` and `SystemRoot` in a normal shell,
 * `PATH` under CI - so a literal lookup finds one machine's variables and not
 * the other's. Matching on the upper-cased key catches both, and the child is
 * given back the spelling its parent used.
 */
const ALLOWED = new Set([
  'PATH',
  'PATHEXT',
  'SYSTEMROOT',
  'SYSTEMDRIVE',
  'WINDIR',
  'COMSPEC',
  'TEMP',
  'TMP',
  'USERPROFILE',
  'HOME',
  'JAVA_HOME',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'PYTHONIOENCODING',
  'TZ',
]);

/** The allow-list itself, for the test that proves a name is not on it. */
export const ALLOWED_CHILD_ENV = Object.freeze([...ALLOWED]);

/**
 * Builds a child environment from the allow-list.
 *
 * `extra` is merged last and is for values the judge itself sets (the harness
 * has none today; a future one that needs, say, `PYTHONHASHSEED=0` sets it
 * here rather than by reaching for the parent's).
 */
export function childEnv(
  source: NodeJS.ProcessEnv = process.env,
  extra: Record<string, string> = {},
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};

  for (const [name, value] of Object.entries(source)) {
    if (value === undefined) continue;
    if (ALLOWED.has(name.toUpperCase())) env[name] = value;
  }

  return { ...env, ...extra };
}
