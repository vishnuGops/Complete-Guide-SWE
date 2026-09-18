import { useId, type ReactNode } from 'react';
import {
  LANGUAGES,
  LANGUAGE_LABEL,
  PROGRESS_LABEL,
  PROGRESS_STATUSES,
  TIERS,
  TOPICS,
  TOPIC_LABEL,
  type Language,
  type ProblemListResponse,
  type ProgressStatus,
  type Tier,
  type Topic,
} from '@devpromax/shared';
import { Button, cn } from '../../ui/index.js';
import { isFiltered, toggle, type ProblemFilters } from './query.js';

/**
 * The filter sidebar (ROADMAP P4-5).
 *
 * Checkboxes rather than a row of pills or a multi-select: fourteen topics is
 * too many for pills, and a `<select multiple>` hides the counts that are half
 * the reason to look at this panel at all. "HashMap 3/14" is the sentence a
 * user wants before deciding what to practise next.
 *
 * Counts come from the unfiltered catalogue (`byTopic`, which the API computes
 * over everything regardless of the query), so they do not move as the list
 * narrows. A count that changed when you ticked its own box would be useless.
 */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-border border-b px-3 py-3 last:border-b-0">
      <h2 className="text-fg-subtle mb-2 text-2xs font-medium tracking-wide uppercase">{title}</h2>
      {children}
    </section>
  );
}

/**
 * One filter row.
 *
 * A native checkbox, tinted with `accent-color`. Radix has no checkbox we are
 * using and this needs none: the native control is keyboard-operable, announced
 * correctly, and in a list of twenty-odd rows it is the one that does not cost a
 * component per row.
 */
function Check({
  checked,
  onChange,
  label,
  count,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  count?: { solved: number; total: number };
}) {
  const id = useId();
  return (
    <div className="py-0.5">
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="focus-ring accent-accent size-3.5 shrink-0 cursor-pointer"
        />
        <label
          htmlFor={id}
          className={cn(
            'flex min-w-0 flex-1 cursor-pointer items-baseline justify-between gap-2 text-sm',
            checked ? 'text-fg' : 'text-fg-muted',
          )}
        >
          <span className="truncate">{label}</span>
          {count && (
            <>
              <span aria-hidden className="text-fg-subtle tnum text-2xs shrink-0">
                {count.solved}/{count.total}
              </span>
              {/*
                The same fact, spelled out for a screen reader (P4-10). "1/4"
                beside a topic is a shorthand the eye expands for free and a
                reader announces as "Arrays one slash four" - which is the sort
                of accessible name that technically contains the information.
              */}
              <span className="sr-only">
                , {count.solved} of {count.total} solved
              </span>
            </>
          )}
        </label>
      </div>
      {count && count.total > 0 && <TopicBar solved={count.solved} total={count.total} />}
    </div>
  );
}

/**
 * How far through a topic the user is (ROADMAP P4-8).
 *
 * Two pixels, indented to sit under its label. The number beside the topic is
 * the answer; this is the shape of the answer, which is what makes fourteen of
 * them comparable at a glance without reading fourteen pairs of numbers. It
 * carries no meaning the count does not already carry, so it is `aria-hidden`
 * and adds no second thing for a screen reader to get through.
 *
 * It updates for free: an accepted submit invalidates the list query, the
 * response carries fresh per-topic counts, and the bar is a function of those.
 */
function TopicBar({ solved, total }: { solved: number; total: number }) {
  const percent = Math.round((solved / total) * 100);
  return (
    <span aria-hidden className="mt-1 ml-5.5 block">
      <span className="bg-surface-sunken block h-0.5 overflow-hidden rounded-xs">
        <span
          className="bg-success block h-full"
          style={{ width: `${String(percent)}%` }}
          data-testid="topic-progress"
        />
      </span>
    </span>
  );
}

export interface FiltersProps {
  filters: ProblemFilters;
  onChange: (next: ProblemFilters) => void;
  counts: ProblemListResponse | undefined;
}

export function Filters({ filters, onChange, counts }: FiltersProps) {
  const byTopic = new Map(counts?.byTopic.map((row) => [row.topic, row]) ?? []);

  const set = (patch: Partial<ProblemFilters>) => {
    onChange({ ...filters, ...patch });
  };

  return (
    <aside
      className="border-border bg-surface w-56 shrink-0 overflow-y-auto border-r"
      aria-label="Filters"
    >
      <div className="border-border flex h-10 items-center justify-between border-b px-3">
        <h2 className="text-sm font-semibold">Filters</h2>
        {isFiltered(filters) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              // Sort is not a filter and is deliberately left alone.
              // Every filter, the bookmark one included (P7-7). A Clear that
              // leaves one on is a Clear the user has to do twice.
              set({
                topic: [],
                tier: [],
                status: [],
                q: '',
                language: undefined,
                bookmarked: false,
              });
            }}
          >
            Clear all
          </Button>
        )}
      </div>

      <Section title="Topic">
        {TOPICS.map((topic: Topic) => {
          const row = byTopic.get(topic);
          return (
            <Check
              key={topic}
              label={TOPIC_LABEL[topic]}
              checked={filters.topic.includes(topic)}
              onChange={() => {
                set({ topic: toggle(filters.topic, topic, TOPICS) });
              }}
              {...(row ? { count: { solved: row.solved, total: row.total } } : {})}
            />
          );
        })}
      </Section>

      <Section title="Difficulty">
        {/*
          No counts beside the tiers. The list response tallies by topic and by
          status only, and three more numbers are not worth a second request -
          the dashboard is where per-tier progress belongs (P7-5).
        */}
        {TIERS.map((tier: Tier) => (
          <Check
            key={tier}
            label={tier}
            checked={filters.tier.includes(tier)}
            onChange={() => {
              set({ tier: toggle(filters.tier, tier, TIERS) });
            }}
          />
        ))}
      </Section>

      <Section title="Status">
        {PROGRESS_STATUSES.map((status: ProgressStatus) => (
          <Check
            key={status}
            label={PROGRESS_LABEL[status]}
            checked={filters.status.includes(status)}
            onChange={() => {
              set({ status: toggle(filters.status, status, PROGRESS_STATUSES) });
            }}
          />
        ))}
      </Section>

      <Section title="Bookmarks">
        {/*
          One way round only (P7-7). "Starred" is a shortlist someone made on
          purpose; "not starred" is everything else, which is the unfiltered
          list with an extra click.
        */}
        <Check
          checked={filters.bookmarked}
          onChange={() => {
            set({ bookmarked: !filters.bookmarked });
          }}
          label="Starred only"
        />
      </Section>

      {/*
        Not a filter of its own: it re-reads every status as "in this language",
        so `Solved` + `Python` means solved in Python rather than solved in
        either. Radios, because the three options are exclusive by definition.
      */}
      <Section title="Progress in">
        <fieldset>
          <legend className="sr-only">Which language progress is counted in</legend>
          <LanguageChoice
            value={filters.language}
            onChange={(language) => {
              set({ language });
            }}
          />
        </fieldset>
      </Section>
    </aside>
  );
}

function LanguageChoice({
  value,
  onChange,
}: {
  value: Language | undefined;
  onChange: (language: Language | undefined) => void;
}) {
  const name = useId();
  const options: { key: string; label: string; value: Language | undefined }[] = [
    { key: 'any', label: 'Either language', value: undefined },
    ...LANGUAGES.map((language) => ({
      key: language,
      label: LANGUAGE_LABEL[language],
      value: language as Language | undefined,
    })),
  ];

  return (
    <>
      {options.map((option) => {
        const id = `${name}-${option.key}`;
        return (
          <div key={option.key} className="flex items-center gap-2 py-0.5">
            <input
              id={id}
              type="radio"
              name={name}
              checked={value === option.value}
              onChange={() => {
                onChange(option.value);
              }}
              className="focus-ring accent-accent size-3.5 shrink-0 cursor-pointer"
            />
            <label
              htmlFor={id}
              className={cn(
                'cursor-pointer text-sm',
                value === option.value ? 'text-fg' : 'text-fg-muted',
              )}
            >
              {option.label}
            </label>
          </div>
        );
      })}
    </>
  );
}
