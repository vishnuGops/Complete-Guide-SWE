import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { childEnv } from '../childEnv.js';
import { runProcess, type SpawnResult } from '../process.js';
import { DOCKER_COMMAND, DOCKER_IMAGES } from './commands.js';
import { JudgeUnavailableError, type Launcher, type Program } from './launcher.js';

/**
 * The Docker executor's launcher (ROADMAP P9-2).
 *
 * Every judge step - a syntax check, a compile, a batch of tests - is one
 * `docker run --rm` of a stock image with the workspace bind-mounted at `/ws`.
 * One container per step rather than one per run, deliberately: the judge's
 * isolation fallback and its kill-on-stall both assume a step can be killed
 * without disturbing the next, and a container that is killed is gone, which a
 * long-lived container with `docker exec` into it would not be.
 *
 * What the container is denied, and why each matters for *this* threat model -
 * code the user wrote, or pasted from somewhere, running with their account:
 *
 * - `--network none`: no exfiltration, no downloads, no reaching the API on
 *   127.0.0.1 that can itself run code.
 * - `--read-only` with a small tmpfs on `/tmp`: the only writable place that
 *   outlives the step is the workspace, which the judge deletes.
 * - `--cap-drop ALL`, `no-new-privileges`, a non-root user: nothing to escalate
 *   with inside the container.
 * - `--memory`, `--pids-limit`, `--cpus`: a fork bomb or an allocation storm
 *   is the container's problem, not the machine's.
 * - No environment from this process at all: `docker run` passes only what is
 *   named with `--env`, so P2-11's allow-list is structural here.
 * - `timeout -s KILL` inside: if this server dies without killing a container,
 *   the container still ends on its own.
 *
 * Every container carries the `devpromax.judge` label, which is how anything
 * watching the Docker daemon - a notifier, a dashboard - can tell a judge step
 * from a service and leave it alone.
 */

/** The workspace, as every judge container sees it. */
export const CONTAINER_WORKSPACE = '/ws';

export const JUDGE_LABEL = 'devpromax.judge';

/** Seconds past the step's own limit before the in-container backstop fires. */
const BACKSTOP_MARGIN_S = 10;

/**
 * A container start on Docker Desktop is most of a second, and more on a cold
 * cache; the judge's first-result slack was sized for an interpreter start.
 */
const CONTAINER_STARTUP_MS = 4_000;

export const CONTAINER_LIMITS = {
  memory: '1g',
  cpus: '2',
  pids: 256,
  tmp: '64m',
} as const;

const IMAGE_FOR: Record<Program, string> = {
  python: DOCKER_IMAGES.python,
  javac: DOCKER_IMAGES.java,
  java: DOCKER_IMAGES.java,
};

export interface DockerRunSpec {
  name: string;
  image: string;
  hostDir: string;
  program: Program;
  args: readonly string[];
  timeoutMs: number;
  /** `uid:gid`. On Linux the caller's, so the workspace stays theirs to delete. */
  user: string;
}

/**
 * The user a judge container runs as.
 *
 * On Linux a bind mount keeps real ownership, so a container writing as some
 * other uid leaves `.class` files the server cannot delete; running as the
 * server's own uid avoids that without giving the container anything the
 * server's user did not already have. Docker Desktop (Windows, macOS) shares
 * files through a layer that ignores ownership, so there it is `nobody`.
 */
export function containerUser(): string {
  if (process.platform === 'linux' && process.getuid && process.getgid) {
    return `${String(process.getuid())}:${String(process.getgid())}`;
  }
  return '65534:65534';
}

/**
 * The `--mount` value for the workspace.
 *
 * `--mount` is parsed as CSV, so a path containing a comma would split the
 * field; quoting the field (with inner quotes doubled) is the CSV way out. `-v`
 * is not used because its separator is the colon, which every Windows path has.
 */
export function bindMount(hostDir: string): string {
  const source = `source=${hostDir}`.replaceAll('"', '""');
  return `type=bind,"${source}",target=${CONTAINER_WORKSPACE}`;
}

/** Arguments for `docker`, pure so the flags can be asserted without a daemon. */
export function dockerRunArgs(spec: DockerRunSpec): string[] {
  const backstopS = Math.ceil(spec.timeoutMs / 1000) + BACKSTOP_MARGIN_S;
  return [
    'run',
    '--rm',
    // A run is not the moment to download 200 MB. A missing image is reported,
    // with the command that fixes it, instead of turning into a compile timeout.
    '--pull',
    'never',
    '--name',
    spec.name,
    '--label',
    `${JUDGE_LABEL}=1`,
    '--network',
    'none',
    '--read-only',
    '--tmpfs',
    `/tmp:rw,size=${CONTAINER_LIMITS.tmp}`,
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '--pids-limit',
    String(CONTAINER_LIMITS.pids),
    '--memory',
    CONTAINER_LIMITS.memory,
    '--memory-swap',
    CONTAINER_LIMITS.memory,
    '--cpus',
    CONTAINER_LIMITS.cpus,
    '--user',
    spec.user,
    '--mount',
    bindMount(spec.hostDir),
    '--workdir',
    CONTAINER_WORKSPACE,
    // The JVM and Python both want somewhere to call home; / is read-only.
    '--env',
    'HOME=/tmp',
    '--env',
    'LANG=C.UTF-8',
    spec.image,
    'timeout',
    '-s',
    'KILL',
    String(backstopS),
    spec.program,
    ...spec.args,
  ];
}

/**
 * Turns a failure of Docker itself into something a user can act on, or
 * returns null when the step ran and the result is the program's own.
 *
 * The daemon reports its own failures as exit 125 (`docker run` could not even
 * create the container) or, when it cannot be reached at all, as exit 1 with a
 * connection message on stderr and nothing having run - which is why the
 * results file is part of the question.
 */
export function dockerFailure(
  result: Pick<SpawnResult, 'code' | 'stderr' | 'killed'>,
  image: string,
  program: Program,
  ranAnything: boolean,
): string | null {
  if (result.killed || ranAnything) return null;
  const stderr = result.stderr;

  if (
    /failed to connect to the docker API|Cannot connect to the Docker daemon|error during connect/i.test(
      stderr,
    )
  ) {
    return 'The judge is set to run in Docker, and Docker is not running. Start Docker Desktop (or the Docker service) and try again, or unset DEVPROMAX_EXECUTOR to run locally.';
  }

  // 125 is also a code a solution can exit with; the CLI's own errors are the
  // ones that start `docker:`.
  if (result.code === 125 && /^docker:/m.test(stderr)) {
    if (/No such image|Unable to find image/i.test(stderr)) {
      return `The Docker image ${image} is not on this machine. Run: docker pull ${image}`;
    }
    const first = stderr.trim().split('\n')[0] ?? '';
    return `Docker could not start the judge container: ${first.replace(/^docker:\s*/, '')}`;
  }

  // `timeout` could not find the program: the image is not the kind the
  // judge needs - a JRE where a JDK was wanted, say.
  if (result.code === 127 && /failed to run command/i.test(stderr)) {
    return `The Docker image ${image} has no ${program}. Set it to an image that does (DEVPROMAX_DOCKER_${program === 'python' ? 'PYTHON' : 'JAVA'}_IMAGE).`;
  }

  return null;
}

/**
 * The environment of the `docker` client itself - not of the container, which
 * gets nothing but the two `--env` values above.
 *
 * The judge's allow-list (P2-11) is right for an interpreter and wrong for the
 * Docker CLI, which finds its daemon through `DOCKER_HOST` or `DOCKER_CONTEXT`
 * and its config through `DOCKER_CONFIG`. Without these a machine that points
 * Docker somewhere other than the default would pass the doctor and fail every
 * run.
 */
export function dockerClientEnv(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const extra: Record<string, string> = {};
  for (const [name, value] of Object.entries(source)) {
    if (value !== undefined && /^DOCKER_/i.test(name)) extra[name] = value;
  }
  return childEnv(source, extra);
}

/**
 * The workspace as Docker should be told about it: the real, long path.
 *
 * On Windows `os.tmpdir()` can be an 8.3 short name (`VISHNU~1`), which the
 * process that created the directory resolves and Docker Desktop's file
 * sharing may not.
 */
function realDir(dir: string): string {
  try {
    return fs.realpathSync.native(dir);
  } catch {
    return dir;
  }
}

/**
 * Stops a container by name. Killing the `docker` client, which is all the
 * process-tree kill reaches, leaves the container running; this is the kill
 * that actually lands. `--rm` then removes it.
 */
function killContainer(name: string): void {
  try {
    const killer = spawn(DOCKER_COMMAND, ['kill', name], {
      env: dockerClientEnv(),
      stdio: 'ignore',
      detached: true,
      windowsHide: true,
    });
    killer.on('error', () => {
      // Docker is gone, and so is the container with it; the in-container
      // backstop covers the case where only the client was.
    });
    killer.unref();
  } catch {
    // As above.
  }
}

export const dockerLauncher: Launcher = {
  kind: 'docker',
  startupMs: CONTAINER_STARTUP_MS,
  path: (_workspace, name) => path.posix.join(CONTAINER_WORKSPACE, name),
  dir: () => CONTAINER_WORKSPACE,

  async run(program, args, workspace, options) {
    const image = IMAGE_FOR[program];
    const name = `devpromax-judge-${randomUUID()}`;

    let result: SpawnResult;
    try {
      result = await runProcess({
        command: DOCKER_COMMAND,
        args: dockerRunArgs({
          name,
          image,
          hostDir: realDir(workspace.dir),
          program,
          args,
          timeoutMs: options.timeoutMs,
          user: containerUser(),
        }),
        cwd: workspace.dir,
        env: dockerClientEnv(),
        timeoutMs: options.timeoutMs + CONTAINER_STARTUP_MS,
        outputCap: options.outputCap,
        onKill: () => {
          killContainer(name);
        },
        ...(options.stall ? { stall: options.stall } : {}),
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new JudgeUnavailableError(
          `The judge is set to run in Docker, and \`${DOCKER_COMMAND}\` is not on your PATH. Install Docker, set DEVPROMAX_DOCKER to its full path, or unset DEVPROMAX_EXECUTOR to run locally.`,
        );
      }
      throw error;
    }

    const ranAnything = options.stall ? options.stall.progress() > 0 : false;
    const failure = dockerFailure(result, image, program, ranAnything);
    if (failure !== null) throw new JudgeUnavailableError(failure);
    return result;
  },
};
