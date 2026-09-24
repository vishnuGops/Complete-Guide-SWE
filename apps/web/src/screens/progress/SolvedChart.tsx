import { useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { ActiveDay } from '@devpromax/shared';
import { localDay } from '../../lib/relativeDay.js';

/**
 * Solves over time (ROADMAP P9-6, docs/DESIGN.md 8).
 *
 * One series, so one line in the accent and no legend - the card's title names
 * it. The line is cumulative: the number of problems first accepted by each
 * day, which is the shape of "how far through the catalogue" and never dips,
 * so a quiet week reads as a flat stretch rather than as a fall.
 *
 * The area under the line is filled with the line's own colour fading out -
 * the one gradient DESIGN.md 6 allows, because it shows the area the line
 * encloses. Gridlines are hairlines in `border`, the axis text `fg-subtle`,
 * and the only number drawn on the chart is the last one.
 *
 * Readable three ways, so the picture is never the only copy of the data:
 * hovering or arrowing along it shows a day and its count; the numeral above
 * the chart says the total; and a table with every point is there for a screen
 * reader (visually hidden - the chart itself is `aria-hidden` apart from its
 * focusable frame, which announces the point under the cursor).
 */

export type ChartRange = '1m' | '3m' | 'all';

const DAY_MS = 86_400_000;
const RANGE_DAYS: Record<Exclude<ChartRange, 'all'>, number> = { '1m': 30, '3m': 90 };

function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface ChartPoint {
  day: string;
  total: number;
}

/**
 * The cumulative series for a range, one point per day, ending today.
 *
 * `solves` is first solves per day, in any order. Solves before the range are
 * the line's starting height, so a one-month view of someone forty problems in
 * starts at forty rather than at zero.
 */
export function cumulative(
  solves: readonly ActiveDay[],
  range: ChartRange,
  now = new Date(),
): ChartPoint[] {
  // The local date (P7-11): the server sends the viewer's own days.
  const today = new Date(`${localDay(now)}T00:00:00.000Z`);
  const sorted = [...solves].sort((a, b) => a.day.localeCompare(b.day));
  const first = sorted[0]?.day;
  const span =
    range === 'all'
      ? Math.max(
          30,
          first === undefined
            ? 30
            : Math.round((today.getTime() - Date.parse(`${first}T00:00:00.000Z`)) / DAY_MS) + 2,
        )
      : RANGE_DAYS[range];

  const start = new Date(today.getTime() - (span - 1) * DAY_MS);
  const startDay = utcDay(start);
  let total = sorted.filter((entry) => entry.day < startDay).reduce((sum, e) => sum + e.count, 0);
  const byDay = new Map(sorted.map((entry) => [entry.day, entry.count]));

  const points: ChartPoint[] = [];
  for (let t = start.getTime(); t <= today.getTime(); t += DAY_MS) {
    const day = utcDay(new Date(t));
    total += byDay.get(day) ?? 0;
    points.push({ day, total });
  }
  return points;
}

/**
 * Clean ticks: 0 and up to three more, on round numbers.
 *
 * Never a step under 1 (P4-17): the axis counts problems, and with one solve
 * the round step came out at 0.5 - ticks 0, 0.5, 1, rounded for printing to
 * 0, 1, 1, which drew the label twice and handed React two children with the
 * same key.
 */
export function ticksFor(max: number): number[] {
  if (max <= 0) return [0, 1];
  const rough = max / 3;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const round = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? rough;
  const step = Math.max(1, round);
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v));
  return ticks;
}

function shortDate(day: string): string {
  return new Date(`${day}T00:00:00.000Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

const WIDTH = 640;
const HEIGHT = 160;
const PAD = { top: 12, right: 36, bottom: 22, left: 28 };

export function SolvedChart({ points }: { points: readonly ChartPoint[] }) {
  const gradientId = useId();
  const frame = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<number | null>(null);
  // Announce the point only while the keyboard is walking the line; a mouse
  // passing over the chart must not make a screen reader talk.
  const [focused, setFocused] = useState(false);

  const geometry = useMemo(() => {
    const max = Math.max(1, ...points.map((p) => p.total));
    const ticks = ticksFor(max);
    const top = ticks[ticks.length - 1] ?? max;
    const innerW = WIDTH - PAD.left - PAD.right;
    const innerH = HEIGHT - PAD.top - PAD.bottom;
    const x = (i: number) =>
      PAD.left + (points.length <= 1 ? innerW : (i / (points.length - 1)) * innerW);
    const y = (v: number) => PAD.top + innerH - (v / top) * innerH;
    const line = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.total).toFixed(1)}`)
      .join('');
    const area = `${line}L${x(points.length - 1).toFixed(1)},${y(0).toFixed(1)}L${x(0).toFixed(1)},${y(0).toFixed(1)}Z`;
    return { ticks, x, y, line, area, innerW };
  }, [points]);

  if (points.length === 0) return null;
  const last = points[points.length - 1] as ChartPoint;
  const firstPoint = points[0] as ChartPoint;
  const hovered = at === null ? null : (points[at] ?? null);

  const pick = (event: PointerEvent<HTMLDivElement>) => {
    const box = frame.current?.getBoundingClientRect();
    if (!box) return;
    const fraction = ((event.clientX - box.left) / box.width) * WIDTH;
    const index = Math.round(((fraction - PAD.left) / geometry.innerW) * (points.length - 1));
    setAt(Math.min(points.length - 1, Math.max(0, index)));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = at ?? points.length - 1;
    let next: number;
    if (event.key === 'ArrowLeft') next = Math.max(0, current - 1);
    else if (event.key === 'ArrowRight') next = Math.min(points.length - 1, current + 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = points.length - 1;
    else if (event.key === 'Escape') {
      setAt(null);
      return;
    } else return;
    event.preventDefault();
    setAt(next);
  };

  return (
    <div className="relative">
      {/*
        The frame takes focus so the arrow keys can walk the line; what it
        announces is the point under the cursor, as text in the live tooltip.
      */}
      {/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={frame}
        role="group"
        tabIndex={0}
        aria-label={`Problems solved over time. ${String(last.total)} by ${shortDate(last.day)}. Use the arrow keys to read each day.`}
        className="focus-ring rounded-md"
        onPointerMove={pick}
        onPointerLeave={() => {
          setAt(null);
        }}
        onKeyDown={onKeyDown}
        onFocus={() => {
          setFocused(true);
        }}
        onBlur={() => {
          setAt(null);
          setFocused(false);
        }}
      >
        {/* eslint-enable jsx-a11y/no-noninteractive-element-interactions */}
        <svg
          aria-hidden
          // Nothing paints in the default black: every mark sets its own colour.
          fill="none"
          viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
          className="block h-40 w-full"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {geometry.ticks.map((tick) => (
            <line
              key={tick}
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={geometry.y(tick)}
              y2={geometry.y(tick)}
              stroke="var(--color-border)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path d={geometry.area} fill={`url(#${gradientId})`} />
          <path
            d={geometry.line}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <circle
            cx={geometry.x(points.length - 1)}
            cy={geometry.y(last.total)}
            r="3"
            fill="var(--color-accent)"
            vectorEffect="non-scaling-stroke"
          />
          {at !== null && (
            <line
              x1={geometry.x(at)}
              x2={geometry.x(at)}
              y1={PAD.top}
              y2={HEIGHT - PAD.bottom}
              stroke="var(--color-border-strong)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {/* Axis text as HTML over the SVG, so it keeps its size when the chart stretches. */}
        {geometry.ticks.map((tick) => (
          <span
            key={tick}
            aria-hidden
            className="text-fg-subtle tnum absolute left-0 -translate-y-1/2 text-2xs"
            style={{ top: `${String((geometry.y(tick) / HEIGHT) * 100)}%` }}
          >
            {tick}
          </span>
        ))}
        <span
          aria-hidden
          className="text-fg tnum absolute right-0 -translate-y-1/2 text-xs font-semibold"
          style={{ top: `${String((geometry.y(last.total) / HEIGHT) * 100)}%` }}
        >
          {last.total}
        </span>
        <span
          aria-hidden
          className="text-fg-subtle absolute bottom-0 text-2xs"
          style={{ left: `${String((PAD.left / WIDTH) * 100)}%` }}
        >
          {shortDate(firstPoint.day)}
        </span>
        <span
          aria-hidden
          className="text-fg-subtle absolute bottom-0 text-2xs"
          style={{ right: `${String((PAD.right / WIDTH) * 100)}%` }}
        >
          Today
        </span>
      </div>

      <p
        aria-live={focused ? 'polite' : 'off'}
        className={
          hovered
            ? 'bg-overlay border-border shadow-overlay text-fg tnum pointer-events-none absolute top-0 rounded-md border px-2 py-1 text-xs'
            : 'sr-only'
        }
        style={
          hovered && at !== null
            ? {
                left: `${String(Math.min(80, Math.max(0, (geometry.x(at) / WIDTH) * 100 - 8)))}%`,
              }
            : undefined
        }
      >
        {hovered ? `${shortDate(hovered.day)}: ${String(hovered.total)} solved` : ''}
      </p>

      <table className="sr-only">
        <caption>Problems solved, cumulative, by day</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Solved</th>
          </tr>
        </thead>
        <tbody>
          {points
            .filter(
              (point, index) =>
                index === points.length - 1 || point.total !== points[index + 1]?.total,
            )
            .map((point) => (
              <tr key={point.day}>
                <td>{point.day}</td>
                <td>{point.total}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
