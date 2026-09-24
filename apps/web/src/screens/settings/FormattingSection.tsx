import type { FormatterStatus } from '@devpromax/shared';
import { useFormatters, useRecheckFormatters } from '../../api/hooks.js';
import { Button, cn } from '../../ui/index.js';
import { Row, Section, Toggle } from './fields.js';

/**
 * Formatting (ROADMAP P9-5).
 *
 * Two formatters, neither shipped with the app, both optional. This is where a
 * missing one is explained - the workspace only ever shows Format for a
 * language whose formatter is here, so this section is the one place that
 * says what it would take to get the other.
 */

const LANGUAGE_NAME: Record<FormatterStatus['language'], string> = {
  python: 'Python',
  java: 'Java',
};

function FormatterRow({ status }: { status: FormatterStatus }) {
  return (
    <li className="border-border border-b py-2 last:border-b-0">
      <p className="flex items-baseline gap-2 text-sm">
        <span
          aria-hidden
          className={cn(
            'size-1.5 shrink-0 rounded-full',
            status.available ? 'bg-success' : 'bg-border-strong',
          )}
        />
        <span className="shrink-0 font-medium whitespace-nowrap">{status.name}</span>
        <span className="text-fg-subtle shrink-0 text-xs">{LANGUAGE_NAME[status.language]}</span>
        <span className="sr-only">{status.available ? 'is installed' : 'was not found'}</span>
        <span className="text-fg-muted tnum shrink-0 whitespace-nowrap">
          {status.version ?? 'not found'}
        </span>
        {/* A jar path runs long; the full one is on hover, and in npm run doctor. */}
        <code
          className="text-fg-subtle ml-auto min-w-0 truncate font-mono text-2xs"
          title={status.command}
        >
          {status.command}
        </code>
      </p>
      {status.guidance !== null && <p className="text-fg-muted mt-1 text-xs">{status.guidance}</p>}
    </li>
  );
}

export function FormattingSection({
  formatOnSave,
  error = null,
  onFormatOnSave,
}: {
  formatOnSave: boolean;
  /** A refused write of the toggle below (P3-7). */
  error?: Error | null;
  onFormatOnSave: (value: boolean) => void;
}) {
  const formatters = useFormatters();
  const recheck = useRecheckFormatters();
  const list = formatters.data?.formatters;
  const checking = formatters.isFetching || recheck.isPending;

  return (
    <Section
      title="Formatting"
      description="Optional. Format in the workspace, and Ctrl+S when the setting below is on, run these on your code. Neither comes with DevProMax."
      error={error}
    >
      <Row
        label="Format on save"
        hint="Ctrl+S formats, then saves. A language with no formatter just saves."
      >
        <Toggle label="Format on save" checked={formatOnSave} onChange={onFormatOnSave} />
      </Row>

      {list === undefined ? (
        <p className="text-fg-muted text-sm">{checking ? 'Checking…' : 'Not checked yet.'}</p>
      ) : (
        <ul>
          {list.map((status) => (
            <FormatterRow key={status.name} status={status} />
          ))}
        </ul>
      )}

      {(formatters.error ?? recheck.error) && (
        <p className="text-danger-fg text-sm" role="alert">
          {(formatters.error ?? recheck.error)?.message}
        </p>
      )}

      <div>
        <Button
          size="sm"
          variant="secondary"
          disabled={checking}
          onClick={() => {
            recheck.mutate();
          }}
        >
          {recheck.isPending ? 'Checking…' : 'Check again'}
        </Button>
      </div>
    </Section>
  );
}
