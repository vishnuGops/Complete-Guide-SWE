import { useState } from 'react';
import {
  editorPrefsSchema,
  judgePrefsSchema,
  type ResetProgressResponse,
  type SettingsUpdate,
} from '@devpromax/shared';
import { useAbout, useResetProgress, useSettings, useUpdateSettings } from '../../api/hooks.js';
import { ThemeToggle } from '../../app/ThemeToggle.js';
import { RuntimeSection } from './RuntimeSection.js';
import { AboutSection } from './AboutSection.js';
import { PageHeader } from '../../app/PageHeader.js';
import { useAppTheme } from '../../app/useAppTheme.js';
import { Button, Card, ConfirmDialog, ErrorState, Loading, Skeleton } from '../../ui/index.js';
import { CoachSection } from './CoachSection.js';
import { FormattingSection } from './FormattingSection.js';
import { NumberField, Row, Section, Toggle } from './fields.js';

/**
 * Settings (ROADMAP P4-2 for the route, P3-4 for what is behind it).
 *
 * Every field writes as soon as it changes. There is no Save button because
 * there is nothing to save to: the server is on this machine, the write is a
 * millisecond, and a Save button's only real job - "do not commit half a form to
 * a remote system" - is not a problem this app has.
 *
 * The one field that does not follow that rule is the coach's API key (P5-8): it
 * is saved explicitly, because a key is pasted rather than typed and a PUT per
 * character would send eight prefixes of a secret to be written to disk.
 */

const DEFAULT_EDITOR = editorPrefsSchema.parse({});
const DEFAULT_JUDGE = judgePrefsSchema.parse({});

function clearedSummary(cleared: ResetProgressResponse['cleared']): string {
  const parts = [
    [cleared.submissions, 'submission'],
    [cleared.progress, 'progress row'],
    [cleared.drafts, 'draft'],
    [cleared.events, 'activity event'],
    [cleared.coachSessions, 'coach session'],
    [cleared.interviews, 'mock interview'],
  ] as const;

  const said = parts
    .filter(([count]) => count > 0)
    .map(([count, noun]) => `${String(count)} ${noun}${count === 1 ? '' : 's'}`);

  return said.length === 0 ? 'There was nothing to clear.' : `Cleared ${said.join(', ')}.`;
}

/** The card a write came from. Format on save is an editor field in its own card. */
type WriteOrigin = 'coach' | 'editor' | 'formatting' | 'judge' | 'other';

function originOf(patch: SettingsUpdate | undefined): WriteOrigin {
  if (patch?.coach !== undefined) return 'coach';
  if (patch?.judge !== undefined) return 'judge';
  if (patch?.editor !== undefined) {
    return 'formatOnSave' in patch.editor ? 'formatting' : 'editor';
  }
  return 'other';
}

/** The first card's worth of rows, at the height they will be. */
function SettingsSkeleton() {
  return (
    <Loading label="Loading settings" className="max-w-3xl px-6 pb-6">
      <span className="bg-surface border-border block rounded-xl border p-5">
        {Array.from({ length: 5 }, (_, index) => (
          <span key={index} className="flex items-center gap-6 py-3">
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="h-6 w-80" />
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
  const about = useAbout();
  // An installed copy has no project folder and no npm (P10-2, D26).
  const bundled = about.data?.bundled === true;
  const { theme, setTheme } = useAppTheme();
  const [confirming, setConfirming] = useState(false);

  const header = (
    <PageHeader
      title="Settings"
      context="Saved as you change them, in a database on this machine."
    />
  );

  // The header in every state (P9-7), so loading and failing still say where you are.
  if (isPending || error) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {header}
        {isPending ? (
          <SettingsSkeleton />
        ) : (
          <div className="max-w-3xl px-6">
            <Card>
              <ErrorState
                className="p-0"
                title="Settings could not load."
                error={error}
                onRetry={() => {
                  void refetch();
                }}
              />
            </Card>
          </div>
        )}
      </div>
    );
  }

  const editor = settings.editor ?? DEFAULT_EDITOR;
  const judge = settings.judge ?? DEFAULT_JUDGE;

  // A refused write is said in the card it came from (P3-7). The mutation keeps
  // only the latest write's outcome, which is the one worth reporting: the next
  // change clears it.
  const failedIn = update.isError ? originOf(update.variables) : null;
  const errorFor = (origin: WriteOrigin): Error | null =>
    failedIn === origin ? update.error : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {header}
      {/*
        One column of cards, one per section (DESIGN.md 8), left-aligned under
        the title rather than centred: the page reads top to bottom and the
        controls line up in one column down all of it.
      */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
        <div className="flex max-w-3xl flex-col gap-4">
          <CoachSection
            coach={settings.coach}
            saving={update.isPending}
            error={errorFor('coach')}
            onChange={(patch, onSaved) => {
              update.mutate(patch, onSaved ? { onSuccess: onSaved } : undefined);
            }}
          />

          <RuntimeSection bundled={bundled} />

          <Section title="Appearance" description="Applies to the whole app, including the editor.">
            <Row label="Theme" hint="System follows your operating system.">
              <ThemeToggle value={theme} onChange={setTheme} />
            </Row>
          </Section>

          <Section
            title="Editor"
            description="How Monaco behaves in the workspace."
            error={errorFor('editor')}
          >
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

          <FormattingSection
            formatOnSave={editor.formatOnSave}
            error={errorFor('formatting')}
            onFormatOnSave={(formatOnSave) => {
              update.mutate({ editor: { formatOnSave } });
            }}
          />

          <Section
            title="Judge"
            description="How your code is run. The defaults suit a machine that is not busy doing something else."
            error={errorFor('judge')}
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
                fraction
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
              hint="Deletes submissions, statuses, drafts, activity, coach conversations and mock interviews. Your notes, stars and these settings are kept."
            >
              {/*
                Not `disabled` while the reset runs (P4-17): the dialog hands
                focus back to this button as it closes, and a disabled button
                cannot take it - focus fell to the page instead.
              */}
              <Button
                variant="danger"
                aria-disabled={reset.isPending || undefined}
                onClick={() => {
                  if (!reset.isPending) setConfirming(true);
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

          <AboutSection about={about.data} error={about.error} />
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Reset all progress?"
        description={`Every submission, status, draft and activity record is deleted, and every coach conversation and mock interview with them. This cannot be undone. To keep a copy first, ${bundled ? 'use Back up DevProMax data in the Start menu' : 'run npm run db:backup in the project folder'}.`}
        confirmLabel="Delete everything"
        onConfirm={() => {
          reset.mutate();
          setConfirming(false);
        }}
      />
    </div>
  );
}
