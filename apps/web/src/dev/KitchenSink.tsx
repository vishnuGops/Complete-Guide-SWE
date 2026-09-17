import { useState, type ReactNode } from 'react';
import { PROGRESS_STATUSES, THEMES, type Theme } from '@devpromax/shared';
import { applyTheme } from '../theme.js';
import {
  Button,
  ErrorState,
  Input,
  Loading,
  Skeleton,
  StatusMark,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
} from '../ui/index.js';

/**
 * The token and primitive reference (ROADMAP P0-8).
 *
 * Dev-only, and it exists for one reason: every token has to be looked at in
 * both themes side by side before a screen is built on it. A palette that is
 * only ever seen one swatch at a time inside a feature is a palette nobody has
 * actually reviewed.
 *
 * It is also the first thing built with these rules, so it follows them: no
 * shadowed cards, no hero, no emoji, borders and headings do the separating.
 */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-border border-t py-6">
      <h2 className="text-fg-muted mb-4 text-xs font-semibold tracking-wide uppercase">{title}</h2>
      {children}
    </section>
  );
}

function Swatch({ name, className }: { name: string; className: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`border-border h-8 w-8 shrink-0 rounded-md border ${className}`} />
      <code className="text-fg-muted text-2xs">{name}</code>
    </div>
  );
}

const SEMANTIC_SURFACES = [
  'bg-bg',
  'bg-surface',
  'bg-surface-raised',
  'bg-surface-sunken',
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
    'bg-neutral-200',
    'bg-neutral-300',
    'bg-neutral-400',
    'bg-neutral-500',
    'bg-neutral-600',
    'bg-neutral-700',
    'bg-neutral-800',
    'bg-neutral-850',
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
    'bg-accent-600',
    'bg-accent-700',
    'bg-accent-800',
    'bg-accent-900',
  ],
  success: [
    'bg-success-100',
    'bg-success-300',
    'bg-success-500',
    'bg-success-700',
    'bg-success-900',
  ],
  warn: ['bg-warn-100', 'bg-warn-300', 'bg-warn-500', 'bg-warn-700', 'bg-warn-900'],
  danger: ['bg-danger-100', 'bg-danger-300', 'bg-danger-500', 'bg-danger-700', 'bg-danger-900'],
};

const TYPE_SCALE = [
  ['text-2xs', '11px — dense metadata'],
  ['text-xs', '12px — labels, table metadata'],
  ['text-sm', '13px — dense UI'],
  ['text-base', '14px — body, statements'],
  ['text-md', '16px — lead paragraphs'],
  ['text-lg', '18px — panel titles'],
  ['text-xl', '22px — page titles'],
  ['text-2xl', '28px — the largest thing here'],
] as const;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function KitchenSink() {
  const [theme, setTheme] = useState<Theme>('system');
  const [slug, setSlug] = useState('Two Sum!');

  function choose(next: Theme) {
    setTheme(next);
    applyTheme(next);
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <header className="flex items-baseline justify-between gap-4 pb-6">
        <div>
          <h1 className="text-xl font-semibold">Kitchen sink</h1>
          <p className="text-fg-muted text-sm">
            Design tokens and the four primitives (P0-8). Dev only.
          </p>
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="Theme">
          {THEMES.map((choice) => (
            <Button
              key={choice}
              size="sm"
              variant={theme === choice ? 'primary' : 'ghost'}
              aria-pressed={theme === choice}
              onClick={() => {
                choose(choice);
              }}
            >
              {choice}
            </Button>
          ))}
        </div>
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
          <span className="text-success-fg">text-success-fg</span>
          <span className="text-warn-fg">text-warn-fg</span>
          <span className="text-danger-fg">text-danger-fg</span>
        </div>
      </Section>

      <Section title="Ramps">
        <p className="text-fg-muted mb-4 text-sm">
          Fixed. Identical in both themes — only which end a surface uses changes.
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
              <dt className={`${token} w-56 shrink-0 font-medium`}>Binary search</dt>
              <dd className="text-fg-muted text-xs">
                <code>{token}</code> — {note}
              </dd>
            </div>
          ))}
          <div className="flex items-baseline gap-4 pt-2">
            <span className="w-56 shrink-0 font-mono text-sm">nums[mid] &lt;= target</span>
            <span className="text-fg-muted text-xs">
              <code>font-mono</code> — JetBrains Mono, ligatures off
            </span>
          </div>
          <div className="flex items-baseline gap-4">
            <span className="tnum w-56 shrink-0 text-sm">1,284 ms · 18/18</span>
            <span className="text-fg-muted text-xs">
              <code>tnum</code> — tabular figures for timings and counts
            </span>
          </div>
        </dl>
      </Section>

      <Section title="Spacing and radius">
        <div className="flex flex-wrap items-end gap-4">
          {[1, 2, 3, 4, 6, 8].map((step) => (
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
          {['rounded-xs', 'rounded-sm', 'rounded-md', 'rounded-lg'].map((radius) => (
            <div key={radius} className="flex flex-col items-center gap-1">
              <div
                className={`bg-surface-sunken border-border-strong h-10 w-16 border ${radius}`}
              />
              <code className="text-fg-muted text-2xs">{radius}</code>
            </div>
          ))}
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
              {SLUG.test(slug) ? ' ' : 'Lowercase letters, digits and hyphens only.'}
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
          <Tooltip content="Ask the coach about this code" keys={['Ctrl', 'Shift', 'H']} side="top">
            <Button variant="ghost">AI Help</Button>
          </Tooltip>
          <span className="text-fg-muted text-xs">
            Tab to a button: the tooltip opens on focus.
          </span>
        </div>
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
              Skeletons are held back for 150ms and never pulse. On this machine most queries answer
              before they appear at all, which is the point.
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
          Not started prints no word - the mark is the absence of fill, and the label is there for a
          screen reader. Mastered is Solved plus a ring: two greens a reader who cannot separate
          them still tells apart by shape.
        </p>
      </Section>
    </div>
  );
}
