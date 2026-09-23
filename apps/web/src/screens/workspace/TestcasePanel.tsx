import { useId } from 'react';
import {
  MAX_CUSTOM_TESTS,
  type CustomTestInput,
  type CustomTestIssue,
  type CustomTestShape,
  type TestCase,
} from '@devpromax/shared';
import { Button, Input, cn } from '../../ui/index.js';

/**
 * Testcases (ROADMAP P4-6).
 *
 * The problem's own samples, and the cases the user adds. Run executes both;
 * Submit ignores the custom ones entirely, because a recorded verdict has to
 * mean "passed the problem's tests" and not "passed the tests I wrote for
 * myself" (P2-6).
 *
 * A custom case is input with no expectation, and the panel says so rather than
 * offering an "expected" box that the server would refuse: Run with custom input
 * answers *what does my code do with this*, which is a different question from
 * *is my code correct*.
 *
 * Validation is the same `parseCustomTests` the server runs on arrival (it lives
 * in `shared` for exactly this), so the message under the box while typing is
 * word for word the message that would have come back.
 */

export interface TestcasePanelProps {
  samples: readonly TestCase[];
  shape: CustomTestShape;
  inputs: readonly CustomTestInput[];
  onChange: (inputs: CustomTestInput[]) => void;
  /** From `parseCustomTests`, tagged with which case each belongs to. */
  issues: readonly (CustomTestIssue & { case: number })[];
}

function SampleCase({ test, index }: { test: TestCase; index: number }) {
  return (
    <li className="bg-surface-sunken rounded-lg px-3 py-2.5">
      <p className="text-fg-muted mb-1 text-xs font-medium">
        Sample {index + 1}
        {test.name !== undefined && <span className="normal-case"> · {test.name}</span>}
      </p>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-fg-muted text-xs">{test.ops ? 'Constructor' : 'Input'}</dt>
        <dd className="text-fg overflow-x-auto font-mono text-2xs">{JSON.stringify(test.args)}</dd>

        {test.ops && (
          <>
            <dt className="text-fg-muted text-xs">Calls</dt>
            <dd className="text-fg overflow-x-auto font-mono text-2xs">
              {test.ops
                .map((op) => `${op.method}(${op.args.map((a) => JSON.stringify(a)).join(', ')})`)
                .join(', ')}
            </dd>
          </>
        )}

        {test.expected !== undefined && (
          <>
            <dt className="text-fg-muted text-xs">Expected</dt>
            <dd className="text-fg overflow-x-auto font-mono text-2xs">
              {JSON.stringify(test.expected)}
            </dd>
          </>
        )}

        {test.expectedMutatedArgs && (
          <>
            <dt className="text-fg-muted text-xs">After the call</dt>
            <dd className="text-fg overflow-x-auto font-mono text-2xs">
              {test.expectedMutatedArgs
                .map((arg) => `arg ${String(arg.index + 1)} = ${JSON.stringify(arg.value)}`)
                .join(', ')}
            </dd>
          </>
        )}
      </dl>
    </li>
  );
}

function CustomCase({
  input,
  index,
  shape,
  issues,
  onChange,
  onRemove,
}: {
  input: CustomTestInput;
  index: number;
  shape: CustomTestShape;
  issues: readonly CustomTestIssue[];
  onChange: (next: CustomTestInput) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const caseIssues = issues.filter((issue) => issue.argIndex === undefined);

  return (
    <li className="bg-surface-sunken rounded-lg px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-fg-muted text-xs font-medium">Custom {index + 1}</p>
        <Button size="sm" variant="ghost" onClick={onRemove}>
          Remove
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {input.args.map((value, argIndex) => {
          const issue = issues.find((entry) => entry.argIndex === argIndex);
          const fieldId = `${id}-arg-${String(argIndex)}`;
          return (
            <div key={argIndex}>
              <label htmlFor={fieldId} className="text-fg-muted mb-1 block text-xs">
                {shape.mode === 'operations' ? 'Constructor argument' : 'Argument'} {argIndex + 1}
              </label>
              <Input
                id={fieldId}
                mono
                value={value}
                invalid={issue !== undefined}
                aria-describedby={issue ? `${fieldId}-issue` : undefined}
                placeholder={shape.example[argIndex] ?? 'JSON value'}
                onChange={(event) => {
                  const args = [...input.args];
                  args[argIndex] = event.target.value;
                  onChange({ ...input, args });
                }}
              />
              {issue && (
                <p id={`${fieldId}-issue`} className="text-danger-fg mt-1 text-2xs">
                  Argument {argIndex + 1} {issue.message}
                </p>
              )}
            </div>
          );
        })}

        {shape.mode === 'operations' && (
          <div>
            <label htmlFor={`${id}-ops`} className="text-fg-muted mb-1 block text-xs">
              Calls — a JSON array of <code className="font-mono">[method, args]</code> pairs
            </label>
            <textarea
              id={`${id}-ops`}
              rows={3}
              value={input.ops ?? ''}
              placeholder={`[["${shape.methods[0] ?? 'method'}", []]]`}
              onChange={(event) => {
                onChange({ ...input, ops: event.target.value });
              }}
              className={cn(
                'focus-ring bg-surface text-fg placeholder:text-fg-subtle w-full rounded-md border px-2 py-1 font-mono text-xs',
                caseIssues.length > 0 ? 'border-danger' : 'border-border-strong',
              )}
            />
          </div>
        )}

        {caseIssues.map((issue) => (
          <p key={issue.message} className="text-danger-fg text-2xs">
            {issue.message}
          </p>
        ))}
      </div>
    </li>
  );
}

export function TestcasePanel({ samples, shape, inputs, onChange, issues }: TestcasePanelProps) {
  const addCase = () => {
    onChange([
      ...inputs,
      // Prefilled from the first sample, so the box shows the shape of a legal
      // value instead of asking the user to guess the wire format.
      {
        args:
          shape.example.length > 0
            ? [...shape.example]
            : Array.from({ length: shape.argCount }, () => ''),
        ...(shape.mode === 'operations' ? { ops: '[]' } : {}),
      },
    ]);
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      {/*
        `h2`, not `h3`. The only `h1` on this screen is the problem title, and
        the `h2`s that used to sit between them belong to the statement's
        markdown - so on any left tab but Description these jumped straight from
        1 to 3. Latent since P4-6 and invisible to the axe gate, which is set at
        serious; adding the Coach tab (P5-3) made it a third way to reach.
      */}
      <section>
        <h2 className="text-fg mb-2 text-xs font-semibold">Samples</h2>
        <ul className="flex flex-col gap-2">
          {samples.map((test, index) => (
            <SampleCase key={index} test={test} index={index} />
          ))}
        </ul>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-fg text-xs font-semibold">Your cases</h2>
          <Button size="sm" onClick={addCase} disabled={inputs.length >= MAX_CUSTOM_TESTS}>
            Add a case
          </Button>
        </div>

        {inputs.length === 0 ? (
          <p className="text-fg-muted text-xs">
            Run executes the samples. Add a case to try your own input — the judge reports what your
            code returns, without deciding whether it is right.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {inputs.map((input, index) => (
              <CustomCase
                key={index}
                input={input}
                index={index}
                shape={shape}
                issues={issues.filter((issue) => issue.case === index)}
                onChange={(next) => {
                  const copy = [...inputs];
                  copy[index] = next;
                  onChange(copy);
                }}
                onRemove={() => {
                  onChange(inputs.filter((_unused, at) => at !== index));
                }}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
