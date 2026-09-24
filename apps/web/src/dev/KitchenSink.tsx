import { useState, type ReactNode } from 'react';
import { Award, Flame } from 'lucide-react';
import { PROGRESS_STATUSES, THEMES, VERDICTS, type Theme } from '@devpromax/shared';
import { applyTheme } from '../app/theme.js';
import {
  Button,
  Callout,
  Card,
  CoachMark,
  DeltaChip,
  ErrorState,
  IconTile,
  Input,
  Keys,
  Kbd,
  ListRow,
  Loading,
  SegmentBar,
  Segmented,
  Skeleton,
  Stat,
  StatusMark,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  VerdictTile,
} from '../ui/index.js';

/**
 * The token and primitive reference (ROADMAP P0-8; version 2 by P9-6).
 *
 * Dev-only, and it exists for one reason: every token has to be looked at in
 * both themes side by side before a screen is built on it. A palette that is
 * only ever seen one swatch at a time inside a feature is a palette nobody has
 * actually reviewed.
 *
 * It follows the rules it shows: one card per question, on the canvas, no
 * card inside a card.
 */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <Card title={title}>{children}</Card>;
}

function Swatch({ name, className }: { name: string; className: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`border-border h-8 w-8 shrink-0 rounded-sm border ${className}`} />
      <code className="text-fg-muted text-2xs">{name}</code>
    </div>
  );
}

const SEMANTIC_SURFACES = [
  'bg-bg',
  'bg-surface',
  'bg-surface-raised',
  'bg-surface-sunken',
  'bg-surface-selected',
  'bg-overlay',
  'bg-accent',
  'bg-accent-subtle',
  'bg-success',
  'bg-success-subtle',
  'bg-warn',
  'bg-warn-subtle',
  'bg-danger',
  'bg-danger-subtle',
];

const RAMPS: Record<string, string[]> = {
  neutral: [
    'bg-neutral-0',
    'bg-neutral-50',
    'bg-neutral-100',
    'bg-neutral-150',
    'bg-neutral-200',
    'bg-neutral-300',
    'bg-neutral-400',
    'bg-neutral-500',
    'bg-neutral-600',
    'bg-neutral-700',
    'bg-neutral-750',
    'bg-neutral-800',
    'bg-neutral-850',
    'bg-neutral-875',
    'bg-neutral-900',
    'bg-neutral-950',
    'bg-neutral-1000',
  ],
  accent: [
    'bg-accent-100',
    'bg-accent-200',
    'bg-accent-300',
    'bg-accent-400',
    'bg-accent-500',
    'bg-accent-550',
    'bg-accent-600',
    'bg-accent-700',
    'bg-accent-800',
    'bg-accent-900',
  ],
  keyword: ['bg-keyword-300', 'bg-keyword-700'],
  success: [
    'bg-success-100',
    'bg-success-300',
    'bg-success-500',
    'bg-success-700',
    'bg-success-900',
  ],
  warn: ['bg-warn-100', 'bg-warn-300', 'bg-warn-500', 'bg-warn-700', 'bg-warn-900'],
  danger: [
    'bg-danger-100',
    'bg-danger-300',
    'bg-danger-500',
    'bg-danger-600',
    'bg-danger-700',
    'bg-danger-900',
  ],
};

const TYPE_SCALE = [
  ['text-2xs', '11px — keyboard chips, dense metadata'],
  ['text-xs', '12px — meta lines, labels'],
  ['text-sm', '13px — dense UI, card titles'],
  ['text-base', '14px — body, statements'],
  ['text-md', '16px — lead paragraphs, coach replies'],
  ['text-lg', '18px — panel titles'],
  ['text-xl', '22px — page titles'],
  ['text-2xl', '28px — secondary stat numerals'],
  ['text-3xl', '36px — the primary stat numeral'],
] as const;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function KitchenSink() {
  const [theme, setTheme] = useState<Theme>('system');
  const [slug, setSlug] = useState('Two Sum!');
  const [language, setLanguage] = useState<'python' | 'java'>('python');

  function choose(next: Theme) {
    setTheme(next);
    applyTheme(next);
  }

  return (
    <div className="bg-bg min-h-screen">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-6 py-8">
        <header className="flex items-center justify-between gap-4 pb-2">
          <div>
            <h1 className="tracking-title text-xl font-semibold">Kitchen sink</h1>
            <p className="text-fg-muted text-sm">
              Design tokens and the primitives in <code className="font-mono">src/ui/</code>. Dev
              only.
            </p>
          </div>
          <Segmented
            label="Theme"
            size="sm"
            options={THEMES.map((choice) => ({ value: choice, label: choice }))}
            value={theme}
            onChange={choose}
          />
        </header>

        <Section title="Semantic colours">
          <p className="text-fg-muted mb-4 text-sm">
            What components use. These are the only colours that change with the theme.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {SEMANTIC_SURFACES.map((name) => (
              <Swatch key={name} name={name} className={name} />
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <span className="text-fg">text-fg</span>
            <span className="text-fg-muted">text-fg-muted</span>
            <span className="text-fg-subtle">text-fg-subtle</span>
            <span className="text-accent-fg">text-accent-fg</span>
            <span className="text-code-keyword font-mono">text-code-keyword</span>
            <span className="text-success-fg">text-success-fg</span>
            <span className="text-warn-fg">text-warn-fg</span>
            <span className="text-danger-fg">text-danger-fg</span>
          </div>
        </Section>

        <Section title="Ramps">
          <p className="text-fg-muted mb-4 text-sm">
            Fixed. Identical in both themes — only which step a surface uses changes.
          </p>
          <div className="space-y-3">
            {Object.entries(RAMPS).map(([name, steps]) => (
              <div key={name} className="flex items-center gap-3">
                <code className="text-fg-muted w-16 shrink-0 text-2xs">{name}</code>
                <div className="border-border flex h-8 flex-1 overflow-hidden rounded-md border">
                  {steps.map((step) => (
                    <div key={step} className={`flex-1 ${step}`} title={step} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Type">
          <dl className="space-y-2">
            {TYPE_SCALE.map(([token, note]) => (
              <div key={token} className="flex items-baseline gap-4">
                <dt className={`${token} w-64 shrink-0 font-medium`}>Binary search</dt>
                <dd className="text-fg-muted text-xs">
                  <code>{token}</code> — {note}
                </dd>
              </div>
            ))}
            <div className="flex items-baseline gap-4 pt-2">
              <span className="w-64 shrink-0 font-mono text-sm">nums[mid] &lt;= target</span>
              <span className="text-fg-muted text-xs">
                <code>font-mono</code> — JetBrains Mono, ligatures off
              </span>
            </div>
            <div className="flex items-baseline gap-4">
              <span className="text-md w-64 shrink-0 font-serif">
                Your loop is right; the bounds are not.
              </span>
              <span className="text-fg-muted text-xs">
                <code>font-serif</code> — Newsreader, the coach&rsquo;s words only
              </span>
            </div>
            <div className="flex items-baseline gap-4">
              <span className="tnum w-64 shrink-0 text-sm">1,284 ms · 18/18</span>
              <span className="text-fg-muted text-xs">
                <code>tnum</code> — tabular figures for timings and counts
              </span>
            </div>
          </dl>
        </Section>

        <Section title="Spacing, radius, elevation">
          <div className="flex flex-wrap items-end gap-4">
            {[1, 2, 3, 4, 5, 6, 8].map((step) => (
              <div key={step} className="flex flex-col items-center gap-1">
                <div
                  className="bg-accent-subtle border-accent border"
                  style={{ width: step * 4, height: 24 }}
                />
                <code className="text-fg-muted text-2xs">{step}</code>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-end gap-4">
            {[
              'rounded-xs',
              'rounded-sm',
              'rounded-md',
              'rounded-lg',
              'rounded-xl',
              'rounded-full',
            ].map((radius) => (
              <div key={radius} className="flex flex-col items-center gap-1">
                <div
                  className={`bg-surface-sunken border-border-strong h-10 w-16 border ${radius}`}
                />
                <code className="text-fg-muted text-2xs">{radius}</code>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <div className="bg-surface border-border shadow-card rounded-xl border px-4 py-3 text-xs">
              shadow-card (none in dark)
            </div>
            <div className="bg-overlay border-border shadow-overlay rounded-lg border px-4 py-3 text-xs">
              shadow-overlay
            </div>
          </div>
        </Section>

        <Section title="Button">
          <div className="space-y-4">
            {(['md', 'sm'] as const).map((size) => (
              <div key={size} className="flex flex-wrap items-center gap-2">
                <code className="text-fg-muted w-10 text-2xs">{size}</code>
                <Button size={size} variant="primary">
                  Submit
                </Button>
                <Button size={size} variant="primary-outline">
                  <CoachMark />
                  AI Help
                </Button>
                <Button size={size} variant="secondary">
                  Run
                </Button>
                <Button size={size} variant="ghost">
                  Reset
                </Button>
                <Button size={size} variant="danger">
                  Delete all progress
                </Button>
                <Button size={size} variant="primary" disabled>
                  Disabled
                </Button>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Segmented and keys">
          <div className="flex flex-wrap items-center gap-4">
            <Segmented
              label="Language"
              options={[
                { value: 'python', label: 'Python' },
                { value: 'java', label: 'Java' },
              ]}
              value={language}
              onChange={setLanguage}
            />
            <Keys keys={['Ctrl', 'K']} />
            <Kbd>Esc</Kbd>
          </div>
        </Section>

        <Section title="Input">
          <div className="grid max-w-md gap-4">
            <div className="grid gap-1.5">
              <label className="text-xs font-medium" htmlFor="ks-search">
                Search
              </label>
              <Input id="ks-search" placeholder="Title or pattern" />
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-medium" htmlFor="ks-slug">
                Slug
              </label>
              <Input
                id="ks-slug"
                mono
                invalid={!SLUG.test(slug)}
                value={slug}
                aria-describedby="ks-slug-error"
                onChange={(event) => {
                  setSlug(event.target.value);
                }}
              />
              <p id="ks-slug-error" className="text-danger-fg text-xs">
                {SLUG.test(slug) ? ' ' : 'Lowercase letters, digits and hyphens only.'}
              </p>
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-medium" htmlFor="ks-disabled">
                Disabled
              </label>
              <Input id="ks-disabled" disabled value="python" readOnly />
            </div>
          </div>
        </Section>

        <Section title="Tabs">
          <Tabs defaultValue="description">
            <TabsList>
              <TabsTrigger value="description">Description</TabsTrigger>
              <TabsTrigger value="hints">Hints</TabsTrigger>
              <TabsTrigger value="editorial" disabled>
                Editorial
              </TabsTrigger>
              <TabsTrigger value="submissions">Submissions</TabsTrigger>
            </TabsList>
            <TabsContent value="description" className="text-sm">
              Arrow keys move between tabs; Home and End jump to the ends.
            </TabsContent>
            <TabsContent value="hints" className="text-sm">
              One rung at a time (P7-1).
            </TabsContent>
            <TabsContent value="submissions" className="text-sm">
              Newest first.
            </TabsContent>
          </Tabs>
        </Section>

        <Section title="Tooltip">
          <div className="flex flex-wrap items-center gap-3">
            <Tooltip content="Run against the samples" keys={['Ctrl', 'Enter']}>
              <Button variant="secondary">Run</Button>
            </Tooltip>
            <Tooltip
              content="Submit against every test"
              keys={['Ctrl', 'Shift', 'Enter']}
              side="right"
            >
              <Button variant="primary">Submit</Button>
            </Tooltip>
            <span className="text-fg-muted text-xs">
              Tab to a button: the tooltip opens on focus.
            </span>
          </div>
        </Section>

        <Section title="Stats, rows and callouts">
          <div className="flex flex-wrap items-start gap-10">
            <Stat
              value={42}
              label="of 171 problems"
              delta={<DeltaChip good>+3 this week</DeltaChip>}
            />
          </div>
          <ul className="mt-6 max-w-md">
            {VERDICTS.map((verdict) => (
              <ListRow
                key={verdict}
                tile={<VerdictTile verdict={verdict} />}
                title="Pair Sum Index"
                meta={`${verdict} · Python`}
                value="2h ago"
              />
            ))}
            <ListRow
              tile={
                <IconTile>
                  <Award size={14} strokeWidth={1.5} />
                </IconTile>
              }
              title="Mastered"
              meta="a neutral icon tile"
              value="3"
            />
          </ul>
          <div className="mt-6 max-w-md space-y-2">
            <SegmentBar filled={5} total={14} />
            <SegmentBar filled={2} total={9} tone="warn" />
          </div>
          <Callout className="mt-6 max-w-md">
            <p className="flex items-center gap-2 text-xs font-medium">
              <CoachMark />
              Next step
            </p>
            <p className="mt-1 font-serif text-md">
              Write the loop invariant down before you touch the bounds.
            </p>
          </Callout>
          <p className="text-fg-muted mt-4 flex items-center gap-2 text-xs">
            <Flame aria-hidden size={14} /> Icons are lucide-react, 1.5px stroke.
          </p>
        </Section>

        <Section title="Loading and error states">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <Loading label="Loading problems">
                {Array.from({ length: 4 }, (_, index) => (
                  <span key={index} className="flex items-center gap-3 py-1.5">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 flex-1" />
                    <Skeleton className="h-3 w-12" />
                  </span>
                ))}
              </Loading>
              <p className="text-fg-muted mt-3 text-xs">
                Skeletons are held back for 150ms and never pulse. On this machine most queries
                answer before they appear at all, which is the point.
              </p>
            </div>
            <div>
              <ErrorState
                className="p-0"
                title="The problem list could not load."
                error={new Error('fetch failed: the server is not answering on 127.0.0.1:5174')}
                onRetry={() => undefined}
              />
            </div>
          </div>
        </Section>

        <Section title="Status mark">
          <div className="flex flex-wrap items-center gap-6">
            {PROGRESS_STATUSES.map((status) => (
              <StatusMark key={status} status={status} />
            ))}
            <StatusMark status="solved" label="Solved in Python" />
          </div>
          <p className="text-fg-muted mt-3 text-xs">
            Shape first: an empty ring, a half-filled ring, a disc, a disc in a ring. Not started
            prints no word - the label is there for a screen reader. In progress is grey, never the
            accent.
          </p>
        </Section>
      </div>
    </div>
  );
}
