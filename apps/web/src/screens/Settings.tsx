import { useId, useState, type ReactNode } from 'react';
import { editorPrefsSchema, judgePrefsSchema, type ResetProgressResponse } from '@devpromax/shared';
import { useResetProgress, useSettings, useUpdateSettings } from '../api/hooks.js';
import { ThemeToggle } from '../app/ThemeToggle.js';
import { useAppTheme } from '../app/useAppTheme.js';
import { Button, ConfirmDialog, ErrorState, Input, Loading, Skeleton } from '../ui/index.js';

/**
 * Settings (ROADMAP P4-2 for the route, P3-4 for what is behind it).
 *
 * Every field writes as soon as it changes. There is no Save button because
 * there is nothing to save to: the server is on this machine, the write is a
 * millisecond, and a Save button's only real job - "do not commit half a form to
 * a remote system" - is not a problem this app has.
 *
 * The coach's provider, model and API key are not here yet. They belong with the
 * feature that uses them (P5-3 and P5-6), which is also what gives the key's
 * masking and "test connection" somewhere to be seen working.
 */

const DEFAULT_EDITOR = editorPrefsSchema.parse({});
const DEFAULT_JUDGE = judgePrefsSchema.parse({});

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="border-border border-b py-5 last:border-b-0">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="text-fg-muted mt-1 mb-3 text-xs">{description}</p>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="min-w-0">
        <p className="text-fg text-sm">{label}</p>
        {hint !== undefined && <p className="text-fg-subtle mt-0.5 text-xs">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function NumberField({
  value,
  min,
  max,
  step = 1,
  label,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  label: string;
  onCommit: (value: number) => void;
}) {
  const id = useId();
  return (
    <>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Input
        id={id}
        type="number"
        className="w-20 text-right tnum"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const next = Number(event.target.value);
          // An out-of-range value is what a half-typed number looks like; the
          // schema would reject it and the field would appear to eat keystrokes.
          if (Number.isFinite(next) && next >= min && next <= max) onCommit(next);
        }}
      />
    </>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  const id = useId();
  return (
    <>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        className="focus-ring accent-accent size-4 cursor-pointer"
        onChange={(event) => {
          onChange(event.target.checked);
        }}
      />
    </>
  );
}

function clearedSummary(cleared: ResetProgressResponse['cleared']): string {
  const parts = [
    [cleared.submissions, 'submission'],
    [cleared.progress, 'progress row'],
    [cleared.drafts, 'draft'],
    [cleared.events, 'activity event'],
    [cleared.coachSessions, 'coach session'],
  ] as const;

  const said = parts
    .filter(([count]) => count > 0)
    .map(([count, noun]) => `${String(count)} ${noun}${count === 1 ? '' : 's'}`);

  return said.length === 0 ? 'There was nothing to clear.' : `Cleared ${said.join(', ')}.`;
}

/** The three sections' worth of rows, at the height they will be. */
function SettingsSkeleton() {
  return (
    <Loading label="Loading settings" className="mx-auto max-w-2xl px-6 py-6">
      <Skeleton className="h-6 w-28" />
      <span className="mt-6 block">
        {Array.from({ length: 5 }, (_, index) => (
          <span key={index} className="flex items-center justify-between gap-6 py-3">
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-6 w-20" />
          </span>
        ))}
      </span>
    </Loading>
  );
}

export function Settings() {
  const { data: settings, isPending, error, refetch } = useSettings();
  const update = useUpdateSettings();
  const reset = useResetProgress();
  const { theme, setTheme } = useAppTheme();
  const [confirming, setConfirming] = useState(false);

  if (isPending) return <SettingsSkeleton />;
  if (error) {
    return (
      <ErrorState
        title="Settings could not load."
        error={error}
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  const editor = settings.editor ?? DEFAULT_EDITOR;
  const judge = settings.judge ?? DEFAULT_JUDGE;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-6 py-6">
        <h1 className="text-xl font-semibold">Settings</h1>

        <Section title="Appearance" description="Applies to the whole app, including the editor.">
          <Row label="Theme" hint="System follows your operating system.">
            <ThemeToggle value={theme} onChange={setTheme} />
          </Row>
        </Section>

        <Section title="Editor" description="How Monaco behaves in the workspace.">
          <Row label="Font size" hint="10 to 24 pixels.">
            <NumberField
              label="Editor font size"
              value={editor.fontSize}
              min={10}
              max={24}
              onCommit={(fontSize) => {
                update.mutate({ editor: { fontSize } });
              }}
            />
          </Row>
          <Row label="Tab size" hint="Spaces per indent level. Python starters assume 4.">
            <NumberField
              label="Editor tab size"
              value={editor.tabSize}
              min={2}
              max={8}
              onCommit={(tabSize) => {
                update.mutate({ editor: { tabSize } });
              }}
            />
          </Row>
          <Row label="Wrap long lines">
            <Toggle
              label="Wrap long lines"
              checked={editor.wordWrap}
              onChange={(wordWrap) => {
                update.mutate({ editor: { wordWrap } });
              }}
            />
          </Row>
          <Row label="Vim keybindings" hint="Adds a mode line under the editor.">
            <Toggle
              label="Vim keybindings"
              checked={editor.vimKeybindings}
              onChange={(vimKeybindings) => {
                update.mutate({ editor: { vimKeybindings } });
              }}
            />
          </Row>
        </Section>

        <Section
          title="Judge"
          description="How your code is run. The defaults suit a machine that is not busy doing something else."
        >
          <Row
            label="Time limit multiplier"
            hint="Multiplies every problem's limits. Raise it if correct solutions time out on this machine."
          >
            <NumberField
              label="Time limit multiplier"
              value={judge.timeoutMultiplier}
              min={0.5}
              max={5}
              step={0.5}
              onCommit={(timeoutMultiplier) => {
                update.mutate({ judge: { timeoutMultiplier } });
              }}
            />
          </Row>
          <Row label="Concurrent runs" hint="How many judge runs may execute at once.">
            <NumberField
              label="Concurrent runs"
              value={judge.concurrency}
              min={1}
              max={8}
              onCommit={(concurrency) => {
                update.mutate({ judge: { concurrency } });
              }}
            />
          </Row>
        </Section>

        <Section
          title="Progress"
          description="Your practice history lives in a SQLite file on this machine and nowhere else."
        >
          <Row
            label="Reset all progress"
            hint="Deletes submissions, statuses, drafts and activity. Your notes and these settings are kept."
          >
            <Button
              variant="danger"
              disabled={reset.isPending}
              onClick={() => {
                setConfirming(true);
              }}
            >
              Reset…
            </Button>
          </Row>

          {reset.isSuccess && (
            <p className="text-fg-muted text-xs" role="status">
              {clearedSummary(reset.data.cleared)}
            </p>
          )}
          {reset.error && (
            <p className="text-danger-fg text-xs" role="alert">
              {reset.error.message}
            </p>
          )}
        </Section>
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Reset all progress?"
        description="Every submission, status, draft and activity record is deleted. This cannot be undone, and there is no backup until the packaging work lands."
        confirmLabel="Delete everything"
        onConfirm={() => {
          reset.mutate();
          setConfirming(false);
        }}
      />
    </div>
  );
}
