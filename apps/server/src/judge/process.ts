import { spawn, type ChildProcess } from 'node:child_process';
import { OUTPUT_CAP_BYTES } from '@devpromax/shared';
import { childEnv } from './childEnv.js';

export interface SpawnOptions {
  command: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
  /** Combined stdout+stderr kept before truncation. */
  outputCap?: number;
  /**
   * The child's whole environment. Defaults to the allow-list in
   * `childEnv.ts` - never `process.env`, which carries the coach API key
   * (ROADMAP P2-11).
   */
  env?: NodeJS.ProcessEnv;
  /**
   * Kill the child when it stops making progress (ROADMAP P2-13).
   *
   * The per-test watchdog lives *inside* the harness, and in Python it is a
   * `threading.Timer` that cannot fire while a C call holds the GIL: a
   * catastrophic regex or `[0] * 10**9` is uninterruptible, so the only bound
   * left was the batch's whole wall clock - 85 seconds for twenty hidden tests,
   * and then the isolation fallback runs them again.
   *
   * `progress` is polled and compared with its previous value; when it has not
   * changed for `ms`, the tree is killed and the run is reported as killed,
   * exactly as the wall-clock timeout is. The judge passes the size of the
   * results file, which grows once per completed test.
   */
  stall?: { ms: number; progress: () => number };
  /**
   * Called whenever the judge kills this child - its watchdog, the stall
   * watchdog, or Ctrl+C - after the process tree is killed (ROADMAP P9-2).
   *
   * For children whose tree is not the whole story: killing the `docker`
   * client does not stop the container it started, so the Docker executor
   * uses this to `docker kill` the container by name. Must not throw.
   */
  onKill?: () => void;
  /**
   * Written to the child's stdin, which is then closed (ROADMAP P9-5).
   *
   * For the formatters, which read source from stdin so that nothing is
   * written to disk to be cleaned up. Judge runs leave it unset and keep stdin
   * closed from the start - see `runProcess`.
   */
  input?: string;
  /**
   * Kills the tree when aborted, exactly as the watchdog does (ROADMAP P2-17).
   *
   * The request that asked for a run can go away - a closed tab, a navigation -
   * and until this existed its JVM ran to the end of every hidden test for a
   * verdict nobody would read, holding a queue slot the next Run was waiting
   * for. The result is reported as killed; deciding that it means "cancelled"
   * rather than "timed out" is the caller's, which still holds the signal.
   */
  signal?: AbortSignal;
}

export interface SpawnResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  /** True when the watchdog killed the process rather than it exiting. */
  killed: boolean;
  outputTruncated: boolean;
  elapsedMs: number;
}

/**
 * Every judge child currently running (ROADMAP P3-6).
 *
 * Needed for one thing: Ctrl+C. Node kills the process, not its grandchildren,
 * so a `java` holding a workspace open survived the server that started it -
 * and on Windows kept the directory undeletable until someone found it in the
 * task list. The set is small by construction (the queue is two wide by
 * default) and entries remove themselves when the child exits.
 */
const live = new Map<ChildProcess, (() => void) | undefined>();

/** Kills every judge child and everything they started, containers included. */
export function killLiveChildren(): number {
  const count = live.size;
  for (const [child, onKill] of live) {
    killTree(child);
    onKill?.();
  }
  live.clear();
  return count;
}

/**
 * Kills a process and everything it started.
 *
 * A solution that spawns children - deliberately or through a library - would
 * otherwise leave orphans holding the workspace open, which on Windows makes the
 * directory undeletable. `taskkill /T /F` walks the tree; on POSIX the child is
 * its own process-group leader (`detached`) so a negative PID signals the group.
 */
function killTree(child: ChildProcess): void {
  const pid = child.pid;
  if (pid === undefined) return;

  if (process.platform === 'win32') {
    // Detached and unref'd: reaping the tree must not keep the judge alive, and
    // a failure here (the process already exited) is not interesting.
    //
    // The `error` handler is not optional (P2-11): `spawn` reports a failure to
    // start - taskkill missing from a trimmed PATH, or the process table full -
    // as an `error` *event*, not a throw. Unhandled, that event is an
    // uncaught exception on an EventEmitter, which takes the server down and
    // with it the queue slot this kill was supposed to free.
    try {
      const killer = spawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
        stdio: 'ignore',
        detached: true,
      });
      killer.on('error', () => {
        forceKill(child);
      });
      killer.unref();
    } catch {
      forceKill(child);
    }
    return;
  }

  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    forceKill(child);
  }
}

/** Last resort: the child alone, and never a throw - it may already be gone. */
function forceKill(child: ChildProcess): void {
  try {
    child.kill('SIGKILL');
  } catch {
    // Already gone, which is the outcome this function wanted anyway.
  }
}

/**
 * Runs a command to completion with a wall-clock limit and a byte cap on its
 * output.
 *
 * stdin is closed, so a solution that reads input fails immediately with EOF
 * instead of hanging until the timeout and reporting a confusing TLE - unless
 * `input` is given, in which case it is written and then closed. The shell
 * is never involved: arguments go to the process verbatim, which is both safer
 * and the only way paths with spaces behave the same on both platforms.
 */
export function runProcess(options: SpawnOptions): Promise<SpawnResult> {
  const cap = options.outputCap ?? OUTPUT_CAP_BYTES;
  const started = process.hrtime.bigint();

  // Nothing to kill yet, so nothing to start: a run cancelled while it waited
  // for the queue must not spawn a JVM on its way out.
  if (options.signal?.aborted) {
    return Promise.reject(abortReason(options.signal));
  }

  return new Promise<SpawnResult>((resolve, reject) => {
    const child = spawn(options.command, options.args, {
      cwd: options.cwd,
      stdio: [options.input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
      shell: false,
      detached: process.platform !== 'win32',
      env: options.env ?? childEnv(),
      windowsHide: true,
    });

    live.set(child, options.onKill);

    let stdout = '';
    let stderr = '';
    let outputTruncated = false;
    let killed = false;
    let settled = false;

    // Once. The stall timer keeps ticking between the kill and the child's
    // `close`, and every tick past the budget would otherwise kill again - for
    // the Docker executor, one more `docker kill` process per tick.
    const kill = (): void => {
      if (killed) return;
      killed = true;
      killTree(child);
      options.onKill?.();
    };

    // One budget for both streams together, which is what `outputCap` and
    // OUTPUT_CAP_BYTES promise (ROADMAP P2-19); each stream used to get the
    // whole cap to itself, so a run could keep twice what it said. Counted in
    // UTF-16 units rather than bytes: the point is a bound, and a byte count
    // would mean re-encoding every chunk to take it.
    const append = (current: string, chunk: string): string => {
      const room = cap - stdout.length - stderr.length;
      if (room <= 0) {
        outputTruncated = true;
        return current;
      }
      if (chunk.length > room) {
        outputTruncated = true;
        return current + chunk.slice(0, room);
      }
      return current + chunk;
    };

    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      stdout = append(stdout, chunk);
    });
    child.stderr?.on('data', (chunk: string) => {
      stderr = append(stderr, chunk);
    });

    if (options.input !== undefined && child.stdin) {
      // A child that exits without reading everything closes the pipe under
      // us; that is its exit code's story to tell, not an unhandled EPIPE.
      child.stdin.on('error', () => undefined);
      child.stdin.end(options.input, 'utf8');
    }

    const watchdog = setTimeout(kill, options.timeoutMs);

    /*
     * The stall watchdog (P2-13).
     *
     * Polled rather than event-driven: what it watches is a file the child
     * writes, and `fs.watch` on Windows is both flaky and more machinery than a
     * stat every few hundred milliseconds. The tick is a quarter of the budget,
     * so the kill lands within 25% of the stated time.
     */
    const stall = options.stall;
    let lastProgress = stall ? stall.progress() : 0;
    let sinceProgress = 0;
    const stallTick = stall ? Math.max(100, Math.floor(stall.ms / 4)) : 0;
    const stallTimer = stall
      ? setInterval(() => {
          const now = stall.progress();
          if (now !== lastProgress) {
            lastProgress = now;
            sinceProgress = 0;
            return;
          }
          sinceProgress += stallTick;
          if (sinceProgress >= stall.ms) kill();
        }, stallTick)
      : undefined;

    options.signal?.addEventListener('abort', kill, { once: true });

    const finish = (code: number | null, signal: NodeJS.Signals | null): void => {
      if (settled) return;
      settled = true;
      live.delete(child);
      clearTimeout(watchdog);
      if (stallTimer) clearInterval(stallTimer);
      options.signal?.removeEventListener('abort', kill);
      resolve({
        code,
        signal,
        stdout,
        stderr,
        killed,
        outputTruncated,
        elapsedMs: Number(process.hrtime.bigint() - started) / 1e6,
      });
    };

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      live.delete(child);
      clearTimeout(watchdog);
      if (stallTimer) clearInterval(stallTimer);
      options.signal?.removeEventListener('abort', kill);
      reject(err);
    });

    // 'close' rather than 'exit': it fires once the pipes have drained, so no
    // output written just before exit is lost.
    child.on('close', finish);
  });
}

/**
 * What an aborted signal carries, as an Error. `AbortController.abort()` with
 * no argument gives a DOMException named `AbortError`, which is what every
 * layer above tests for by name.
 */
export function abortReason(signal: AbortSignal): Error {
  const reason: unknown = signal.reason;
  if (reason instanceof Error && isAbortError(reason)) return reason;
  const error = new Error('the run was cancelled');
  error.name = 'AbortError';
  return error;
}

/** True for the error a cancelled run ends with, from whichever layer threw it. */
export function isAbortError(error: unknown): boolean {
  // By name rather than by class: `AbortSignal.reason` is a DOMException,
  // and whether that is an `Error` has varied between Node versions.
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

/** Throws the signal's reason, as an Error, if it has been aborted. */
export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw abortReason(signal);
}
