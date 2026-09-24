import { useId, useState, type ReactNode } from 'react';
import { Card, Input, cn } from '../../ui/index.js';

/**
 * The rows Settings is made of (ROADMAP P3-4, split out by P5-8).
 *
 * Section and Row are layout - one card per section, and every control in one
 * fixed-width column so they line up down the page (P9-6, docs/DESIGN.md 8).
 * The fields exist because a settings screen
 * with no Save button - see the note in `Settings.tsx` - has to decide for
 * itself when a half-typed value becomes a write, and that decision is the same
 * on every row.
 */

export function Section({
  title,
  description,
  error = null,
  children,
}: {
  title: string;
  description: string;
  /**
   * A write from this card the server refused (ROADMAP P3-7). Said in the card
   * that made it, because a page with no Save button has nowhere else to say
   * it - and a change that silently did not happen reads as one that did.
   */
  error?: Error | null;
  children: ReactNode;
}) {
  return (
    <Card title={title} description={description}>
      <div className="flex flex-col gap-4">
        {children}
        {error !== null && (
          <p className="text-danger-fg text-xs" role="alert">
            That change was not saved: {error.message}
          </p>
        )}
      </div>
    </Card>
  );
}

/**
 * The column every control sits in. Fixed, so a number field, a toggle and a
 * segmented control start at the same x on every card of the page.
 */
export function ControlColumn({ children }: { children: ReactNode }) {
  return <div className="flex w-80 shrink-0 items-center gap-2">{children}</div>;
}

export function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-6">
      <div className="min-w-0 flex-1">
        <p className="text-fg text-sm">{label}</p>
        {hint !== undefined && <p className="text-fg-subtle mt-0.5 text-xs">{hint}</p>}
      </div>
      <ControlColumn>{children}</ControlColumn>
    </div>
  );
}

/**
 * A number, committed on blur or Enter (ROADMAP P4-13).
 *
 * The version this replaces wrote straight into a controlled input and only
 * accepted in-range values, which had two consequences: typing "1" on the way
 * to "12" snapped back to the old value, because 1 is below the minimum; and
 * every accepted keystroke was its own PUT. Local text state fixes both - the
 * value is interpreted once, when the user has stopped typing it.
 *
 * Whole numbers unless `fraction` says otherwise (P3-7): the server's schema
 * wants an integer for a font size, and "12.5" used to pass here, go out as a
 * PUT, come back a 400 and be shown nowhere.
 */
export function NumberField({
  value,
  min,
  max,
  step = 1,
  fraction = false,
  label,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Accept values between the integers - the time limit multiplier. */
  fraction?: boolean;
  label: string;
  onCommit: (value: number) => void;
}) {
  const id = useId();
  const serverText = String(value);
  const [text, setText] = useState(serverText);
  const [lastServerText, setLastServerText] = useState(serverText);

  // Follow the server when it changes under us, without overwriting what is
  // being typed right now.
  if (serverText !== lastServerText) {
    setLastServerText(serverText);
    setText(serverText);
  }

  const parsed = Number(text);
  const invalid =
    text.trim() === '' ||
    !Number.isFinite(parsed) ||
    (!fraction && !Number.isInteger(parsed)) ||
    parsed < min ||
    parsed > max;

  function commit(): void {
    if (invalid) {
      // Nothing to send, and the field goes back to what is stored rather than
      // sitting there holding a number the server rejected.
      setText(serverText);
      return;
    }
    if (parsed !== value) onCommit(parsed);
  }

  return (
    <>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Input
        id={id}
        type="text"
        inputMode={fraction ? 'decimal' : 'numeric'}
        className="tnum w-20 text-right"
        value={text}
        invalid={invalid}
        step={step}
        aria-describedby={`${id}-range`}
        onChange={(event) => {
          setText(event.target.value);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
        }}
      />
      <span id={`${id}-range`} className="sr-only">
        {`${fraction ? 'Between' : 'A whole number between'} ${String(min)} and ${String(max)}.`}
      </span>
    </>
  );
}

/**
 * A number that may be absent, committed on blur or Enter.
 *
 * `NumberField` cannot do this job: "no cap" is an empty field, and an empty
 * field is also what the first keystroke of "0.50" looks like. Keeping the
 * text in local state means a value is only interpreted once the user has
 * stopped typing it, and one write is sent rather than one per character.
 */
export function OptionalNumberField({
  value,
  min,
  max,
  step,
  label,
  placeholder,
  className = 'w-24',
  disabled = false,
  onCommit,
}: {
  value: number | null;
  min: number;
  max?: number;
  step?: number;
  label: string;
  placeholder?: string;
  className?: string;
  /** For a setting that cannot mean anything in the current configuration. */
  disabled?: boolean;
  onCommit: (value: number | null) => void;
}) {
  const id = useId();
  const serverText = value === null ? '' : String(value);
  const [text, setText] = useState(serverText);
  const [lastServerText, setLastServerText] = useState(serverText);

  // Follow the server when it changes under us (another tab, a reset), without
  // overwriting what is being typed right now.
  if (serverText !== lastServerText) {
    setLastServerText(serverText);
    setText(serverText);
  }

  const parsed = text.trim() === '' ? null : Number(text);
  const invalid =
    parsed !== null &&
    (!Number.isFinite(parsed) || parsed < min || (max !== undefined && parsed > max));

  function commit(): void {
    if (invalid) {
      setText(serverText);
      return;
    }
    if (parsed !== value) onCommit(parsed);
  }

  return (
    <>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        className={cn('tnum text-right', className)}
        value={text}
        invalid={invalid}
        placeholder={placeholder}
        disabled={disabled}
        step={step}
        onChange={(event) => {
          setText(event.target.value);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
        }}
      />
    </>
  );
}

export function Toggle({
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
        className="focus-ring size-4 cursor-pointer"
        onChange={(event) => {
          onChange(event.target.checked);
        }}
      />
    </>
  );
}

/** Text committed on blur or Enter, for the same reason `OptionalNumberField` is. */
export function TextField({
  value,
  label,
  placeholder,
  className = 'w-56',
  mono = false,
  onCommit,
}: {
  value: string;
  label: string;
  placeholder?: string;
  className?: string;
  mono?: boolean;
  onCommit: (value: string) => void;
}) {
  const id = useId();
  const [text, setText] = useState(value);
  const [lastValue, setLastValue] = useState(value);

  if (value !== lastValue) {
    setLastValue(value);
    setText(value);
  }

  function commit(): void {
    if (text !== value) onCommit(text);
  }

  return (
    <>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Input
        id={id}
        value={text}
        mono={mono}
        placeholder={placeholder}
        className={className}
        onChange={(event) => {
          setText(event.target.value);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
        }}
      />
    </>
  );
}
