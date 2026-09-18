import type { RuntimeCheck, RuntimeName } from '@devpromax/shared';
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

const LABEL: Record<RuntimeName, string> = {
  python: 'Python',
  java: 'Java',
  javac: 'Java compiler',
};

const OVERRIDE: Record<RuntimeName, string> = {
  python: 'DEVPROMAX_PYTHON',
  java: 'DEVPROMAX_JAVA',
  javac: 'DEVPROMAX_JAVAC',
};

function CheckRow({ check }: { check: RuntimeCheck }) {
  return (
    <li className="border-border border-b py-2 last:border-b-0">
      <p className="flex items-baseline gap-2 text-sm">
        <span
          aria-hidden
          className={cn('size-1.5 shrink-0 rounded-full', check.ok ? 'bg-success' : 'bg-danger')}
        />
        <span className="font-medium">{LABEL[check.name]}</span>
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
          <p className="text-fg-subtle mt-1 text-2xs">
            Or set <code className="font-mono">{OVERRIDE[check.name]}</code> and start the app
            again.
          </p>
        </>
      )}
    </li>
  );
}

export function RuntimeSection() {
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
            : 'Python and a JDK 21 or newer. Check them when you have changed an installation.'}
        </p>
      ) : (
        <>
          <ul>
            {check.data.checks.map((entry) => (
              <CheckRow key={entry.name} check={entry} />
            ))}
          </ul>
          <p className="text-fg-subtle mt-2 text-2xs" role="status">
            {check.data.ok
              ? 'Both runtimes are usable.'
              : 'Runs and submissions will fail until this is fixed.'}
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
        className="mt-3"
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
