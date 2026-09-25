import type { ExecutorKind, RuntimeCheck, RuntimeName } from '@devpromax/shared';
import { useRuntimeCheck } from '../../api/hooks.js';
import { Button, cn } from '../../ui/index.js';
import { Section } from './fields.js';

/**
 * What the judge needs, and whether it is there (ROADMAP P8-3).
 *
 * The same check the server runs at start-up, on a screen the user can get back
 * to - because the sequence that actually happens is: try a Run, see it fail,
 * go looking for why. A message in a terminal they closed an hour ago is not an
 * answer.
 *
 * Fetched on demand rather than with the rest of Settings: it spawns a JVM, and
 * nobody opening Settings to change the font size should wait for that.
 */

/*
 * Per executor (ROADMAP P9-2): run locally, "python" is an interpreter on this
 * machine and the escape hatch is the path to another one; run in Docker, it
 * is an image, and the escape hatch is a different image.
 */
const LABEL: Record<ExecutorKind, Record<RuntimeName, string>> = {
  local: { python: 'Python', java: 'Java', javac: 'Java compiler', docker: 'Docker' },
  docker: { python: 'Python image', java: 'Java image', javac: 'Java image', docker: 'Docker' },
};

const OVERRIDE: Record<ExecutorKind, Record<RuntimeName, string>> = {
  local: {
    python: 'DEVPROMAX_PYTHON',
    java: 'DEVPROMAX_JAVA',
    javac: 'DEVPROMAX_JAVAC',
    docker: 'DEVPROMAX_DOCKER',
  },
  docker: {
    python: 'DEVPROMAX_DOCKER_PYTHON_IMAGE',
    java: 'DEVPROMAX_DOCKER_JAVA_IMAGE',
    javac: 'DEVPROMAX_DOCKER_JAVA_IMAGE',
    docker: 'DEVPROMAX_DOCKER',
  },
};

function CheckRow({
  check,
  executor,
  bundled,
}: {
  check: RuntimeCheck;
  executor: ExecutorKind;
  bundled: boolean;
}) {
  return (
    <li className="border-border border-b py-2 last:border-b-0">
      <p className="flex items-baseline gap-2 text-sm">
        <span
          aria-hidden
          className={cn('size-1.5 shrink-0 rounded-full', check.ok ? 'bg-success' : 'bg-danger')}
        />
        <span className="font-medium">{LABEL[executor][check.name]}</span>
        <span className="sr-only">{check.ok ? 'is usable' : 'has a problem'}</span>
        {check.version !== null && <span className="text-fg-muted tnum">{check.version}</span>}
        <code className="text-fg-subtle ml-auto font-mono text-2xs">{check.command}</code>
      </p>

      {!check.ok && (
        <>
          <p className="text-danger-fg mt-1 text-xs">{check.problem}</p>
          {check.guidance !== null && (
            <p className="text-fg-muted mt-1 text-xs">{check.guidance}</p>
          )}
          {/*
            Not in an installed copy (P10-2): its launcher sets these variables
            to the runtimes it brought, over whatever the user sets.
          */}
          {!bundled && (
            <p className="text-fg-subtle mt-1 text-xs">
              Or set <code className="font-mono">{OVERRIDE[executor][check.name]}</code> and start
              the app again.
            </p>
          )}
        </>
      )}
    </li>
  );
}

export function RuntimeSection({ bundled = false }: { bundled?: boolean }) {
  const check = useRuntimeCheck();

  return (
    <Section
      title="Runtimes"
      description="The judge runs your code with these. Everything else in the app works without them."
    >
      {check.data === undefined ? (
        <p className="text-fg-muted text-sm">
          {check.isFetching
            ? 'Checking…'
            : bundled
              ? 'DevProMax brings its own Python and JDK. Check them if a Run fails for no reason in your code.'
              : 'Python and a JDK 21 or newer. Check them when you have changed an installation.'}
        </p>
      ) : (
        <>
          {check.data.executor === 'docker' && (
            <p className="text-fg-muted mb-1 text-xs">
              The judge runs your code in Docker containers, so only Docker and its two images are
              checked.
            </p>
          )}
          <ul>
            {check.data.checks.map((entry) => (
              <CheckRow
                key={entry.name}
                check={entry}
                executor={check.data.executor}
                bundled={bundled}
              />
            ))}
          </ul>
          <p className="text-fg-subtle mt-2 text-xs" role="status">
            {!check.data.ok
              ? 'Runs and submissions will fail until this is fixed.'
              : check.data.executor === 'docker'
                ? 'Docker and both images are ready.'
                : 'Both runtimes are usable.'}
          </p>
        </>
      )}

      {check.error && (
        <p className="text-danger-fg mt-2 text-sm" role="alert">
          {check.error.message}
        </p>
      )}

      <Button
        size="sm"
        variant="secondary"
        // Sized to its label: the section's column would otherwise stretch it
        // across the card (P9-6).
        className="mt-3 self-start"
        disabled={check.isFetching}
        onClick={() => {
          void check.refetch();
        }}
      >
        {check.isFetching ? 'Checking…' : 'Check now'}
      </Button>
    </Section>
  );
}
