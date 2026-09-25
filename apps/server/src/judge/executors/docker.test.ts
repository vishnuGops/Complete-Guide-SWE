import { describe, expect, it } from 'vitest';
import { parseExecutorKind } from './commands.js';
import {
  CONTAINER_LIMITS,
  CONTAINER_SHARED,
  CONTAINER_WORKSPACE,
  JUDGE_LABEL,
  bindMount,
  dockerClientEnv,
  dockerFailure,
  dockerLauncher,
  dockerRunArgs,
  type DockerRunSpec,
} from './docker.js';

/**
 * The Docker launcher's flags, asserted without a daemon (ROADMAP P9-2).
 *
 * Every restriction here is one line in an argument list, and a refactor that
 * drops `--network none` would still produce a judge that passes every
 * functional test. So the list itself is the thing under test; the integration
 * suite then proves the restrictions hold in a real container.
 */

const spec: DockerRunSpec = {
  name: 'devpromax-judge-test',
  image: 'python:3.14-slim',
  hostDir: 'C:\\Users\\Some One\\data\\judge\\abc',
  program: 'python',
  args: ['-X', 'utf8', '-I', '/ws/runner.py', '/ws/payload.json'],
  timeoutMs: 12_500,
  user: '65534:65534',
};

/** The value after a flag, for flags that take one. */
function valueOf(args: readonly string[], flag: string): string | undefined {
  const at = args.indexOf(flag);
  return at === -1 ? undefined : args[at + 1];
}

describe('dockerRunArgs', () => {
  const args = dockerRunArgs(spec);

  it('removes the container, never pulls, and labels it as a judge step', () => {
    expect(args.slice(0, 2)).toEqual(['run', '--rm']);
    expect(valueOf(args, '--pull')).toBe('never');
    expect(valueOf(args, '--name')).toBe(spec.name);
    expect(valueOf(args, '--label')).toBe(`${JUDGE_LABEL}=1`);
  });

  it('denies the network, the root filesystem, capabilities and escalation', () => {
    expect(valueOf(args, '--network')).toBe('none');
    expect(args).toContain('--read-only');
    expect(valueOf(args, '--tmpfs')).toBe(`/tmp:rw,size=${CONTAINER_LIMITS.tmp}`);
    expect(valueOf(args, '--cap-drop')).toBe('ALL');
    expect(valueOf(args, '--security-opt')).toBe('no-new-privileges');
    expect(valueOf(args, '--user')).toBe('65534:65534');
  });

  it('bounds memory with no swap on top, processes and CPU', () => {
    expect(valueOf(args, '--memory')).toBe(CONTAINER_LIMITS.memory);
    expect(valueOf(args, '--memory-swap')).toBe(CONTAINER_LIMITS.memory);
    expect(valueOf(args, '--pids-limit')).toBe(String(CONTAINER_LIMITS.pids));
    expect(valueOf(args, '--cpus')).toBe(CONTAINER_LIMITS.cpus);
  });

  it('passes no environment but the two variables it names', () => {
    const named = args.flatMap((arg, i) => (arg === '--env' ? [args[i + 1]] : []));
    expect(named).toEqual(['HOME=/tmp', 'LANG=C.UTF-8']);
    // `-e`/`--env-file` would be the other ways in; neither may appear.
    expect(args).not.toContain('-e');
    expect(args).not.toContain('--env-file');
  });

  it('mounts the workspace at /ws and runs from there', () => {
    expect(valueOf(args, '--mount')).toBe(bindMount(spec.hostDir));
    expect(valueOf(args, '--workdir')).toBe(CONTAINER_WORKSPACE);
    // Nothing else is mounted unless the step asks for the shared files.
    expect(args.filter((arg) => arg === '--mount')).toHaveLength(1);
  });

  it('mounts the shared harness read-only, beside the workspace (P2-18)', () => {
    const withShared = dockerRunArgs({ ...spec, sharedDir: 'C:\\data\\devpromax-judge-cache\\h' });
    const mounts = withShared.flatMap((arg, i) => (arg === '--mount' ? [withShared[i + 1]] : []));
    expect(mounts).toEqual([
      bindMount(spec.hostDir),
      'type=bind,"source=C:\\data\\devpromax-judge-cache\\h",target=/devpromax,readonly',
    ]);
    expect(CONTAINER_SHARED).toBe('/devpromax');
  });

  it('runs the program under a KILL backstop past its own limit, then its arguments verbatim', () => {
    const at = args.indexOf(spec.image);
    // 12.5 s rounds up to 13, plus the ten-second margin.
    expect(args.slice(at)).toEqual([
      spec.image,
      'timeout',
      '-s',
      'KILL',
      '23',
      'python',
      ...spec.args,
    ]);
  });
});

describe('bindMount', () => {
  it('quotes the source, so a path with spaces or commas stays one field', () => {
    expect(bindMount('C:\\a b\\c,d')).toBe('type=bind,"source=C:\\a b\\c,d",target=/ws');
  });

  it('doubles a quote inside the path, which is CSV escaping', () => {
    expect(bindMount('/tmp/say "hi"')).toBe('type=bind,"source=/tmp/say ""hi""",target=/ws');
  });
});

describe('dockerLauncher paths', () => {
  const workspace = {
    dir: 'C:\\data\\judge\\abc',
    file: (n: string) => `C:\\data\\judge\\abc\\${n}`,
  };

  it('names every workspace file as the container sees it, whatever the host is', () => {
    // `path.posix`, deliberately: on a Windows host `path.join` would hand a
    // Linux container a backslash.
    expect(dockerLauncher.path(workspace as never, 'solution.py')).toBe('/ws/solution.py');
    expect(dockerLauncher.dir(workspace as never)).toBe('/ws');
    expect(dockerLauncher.shared(workspace as never, 'C:\\data\\devpromax-judge-cache\\h')).toBe(
      '/devpromax',
    );
    // A Linux class path, whatever the host's separator is.
    expect(dockerLauncher.pathDelimiter).toBe(':');
  });
});

describe('dockerFailure', () => {
  const image = 'python:3.14-slim';
  const failed = (code: number | null, stderr: string, killed = false) => ({
    code,
    stderr,
    killed,
  });

  it('recognises a daemon that cannot be reached, in each wording Docker has used', () => {
    for (const stderr of [
      'failed to connect to the docker API at npipe:////./pipe/docker_engine; check if the path is correct and if the daemon is running',
      'Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?',
      'error during connect: this error may indicate that the docker daemon is not running',
    ]) {
      expect(dockerFailure(failed(1, stderr), image, 'python', false)).toMatch(
        /Docker is not running/,
      );
    }
  });

  it('names a missing image and the command that fetches it', () => {
    const message = dockerFailure(
      failed(125, 'docker: Error response from daemon: No such image: python:3.14-slim'),
      image,
      'python',
      false,
    );
    expect(message).toBe(
      `The Docker image ${image} is not on this machine. Run: docker pull ${image}`,
    );
  });

  it('reports any other daemon refusal with its first line', () => {
    const message = dockerFailure(
      failed(125, 'docker: Error response from daemon: invalid mount config.\nSee more.'),
      image,
      'python',
      false,
    );
    expect(message).toBe(
      'Docker could not start the judge container: Error response from daemon: invalid mount config.',
    );
  });

  it('says so when the image lacks the program, such as a JRE with no javac', () => {
    const message = dockerFailure(
      failed(127, "timeout: failed to run command 'javac': No such file or directory"),
      'eclipse-temurin:21-jre',
      'javac',
      false,
    );
    expect(message).toMatch(/has no javac.*DEVPROMAX_DOCKER_JAVA_IMAGE/);
  });

  it("leaves the program's own failures alone", () => {
    // A solution that exits 125 itself, or prints the daemon's words, is still
    // a solution that failed - never "Docker is broken".
    expect(
      dockerFailure(failed(125, 'Traceback...\nSystemExit: 125'), image, 'python', false),
    ).toBeNull();
    expect(
      dockerFailure(failed(1, 'Solution.java:3: error: ; expected'), image, 'javac', false),
    ).toBeNull();
    expect(
      dockerFailure(failed(1, 'Cannot connect to the Docker daemon'), image, 'python', true),
    ).toBeNull();
    expect(dockerFailure(failed(null, '', true), image, 'python', false)).toBeNull();
  });

  it("does not read the daemon's words inside a compile error as the daemon (P2-19)", () => {
    // javac echoes the offending line under its diagnostic, so a solution
    // whose broken line mentions the phrase used to be "Docker is not running".
    const javac = [
      "/ws/Solution.java:3: error: ';' expected",
      '        String s = "error during connect: Cannot connect to the Docker daemon"',
      '                                                                            ^',
      '1 error',
    ].join('\n');
    expect(dockerFailure(failed(1, javac), image, 'javac', false)).toBeNull();
    expect(
      dockerFailure(
        failed(127, "Solution.java:1: error: timeout: failed to run command 'x'"),
        image,
        'javac',
        false,
      ),
    ).toBeNull();
  });

  it('never blames Docker for a step that exited cleanly', () => {
    expect(
      dockerFailure(failed(0, 'Cannot connect to the Docker daemon'), image, 'python', false),
    ).toBeNull();
  });

  it('still recognises the CLI prefixing its own error', () => {
    expect(
      dockerFailure(
        failed(1, 'docker: error during connect: Post "http://...": open //./pipe/docker_engine'),
        image,
        'python',
        false,
      ),
    ).toMatch(/Docker is not running/);
  });
});

describe('parseExecutorKind', () => {
  it('defaults to local, and takes either kind in any case', () => {
    expect(parseExecutorKind(undefined)).toBe('local');
    expect(parseExecutorKind('  ')).toBe('local');
    expect(parseExecutorKind('docker')).toBe('docker');
    expect(parseExecutorKind(' Docker ')).toBe('docker');
    expect(parseExecutorKind('LOCAL')).toBe('local');
  });

  it('refuses anything else rather than quietly running unsandboxed', () => {
    expect(() => parseExecutorKind('dokcer')).toThrow(/DEVPROMAX_EXECUTOR.*got "dokcer"/);
  });
});

describe('dockerClientEnv', () => {
  it("gives the Docker client its own settings and still nothing of the coach's", () => {
    const env = dockerClientEnv({
      PATH: '/usr/bin',
      DOCKER_HOST: 'tcp://build-box:2376',
      DOCKER_CONTEXT: 'remote',
      COACH_API_KEY: 'sk-secret',
      DEVPROMAX_DB: '/tmp/x.db',
    });
    expect(env['DOCKER_HOST']).toBe('tcp://build-box:2376');
    expect(env['DOCKER_CONTEXT']).toBe('remote');
    expect(env['PATH']).toBe('/usr/bin');
    expect(env['COACH_API_KEY']).toBeUndefined();
    expect(env['DEVPROMAX_DB']).toBeUndefined();
  });
});
