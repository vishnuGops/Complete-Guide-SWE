import { useId, useState, type ReactNode } from 'react';
import { Input, cn } from '../../ui/index.js';

/**
 * The rows Settings is made of (ROADMAP P3-4, split out by P5-8).
 *
 * Section and Row are layout; the two fields exist because a settings screen
 * with no Save button - see the note in `Settings.tsx` - has to decide for
 * itself when a half-typed value becomes a write, and that decision is the same
 * on every row.
 */

export function Section({
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
    <div className="flex items-start justify-between gap-6">
      <div className="min-w-0">
        <p className="text-fg text-sm">{label}</p>
        {hint !== undefined && <p className="text-fg-subtle mt-0.5 text-xs">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
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
 */
export function NumberField({
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
  const invalid = text.trim() === '' || !Number.isFinite(parsed) || parsed < min || parsed > max;

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
        inputMode="decimal"
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
        {`Between ${String(min)} and ${String(max)}.`}
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
  onCommit,
}: {
  value: number | null;
  min: number;
  max?: number;
  step?: number;
  label: string;
  placeholder?: string;
  className?: string;
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
        className="focus-ring accent-accent size-4 cursor-pointer"
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
