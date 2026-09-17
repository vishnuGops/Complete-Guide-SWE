import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  customTestShapeFrom,
  parseCustomTests,
  type CustomTestInput,
  type TestCase,
} from '@devpromax/shared';
import { TestcasePanel } from './TestcasePanel.js';

/**
 * Custom test cases (ROADMAP P4-6).
 *
 * The panel is wired here exactly as the workspace wires it - parse on every
 * keystroke, feed the issues straight back in - because that loop is what is
 * being tested. The parser itself has its own tests in `shared`; what matters
 * here is that the message it produces reaches the right box.
 *
 * Values arrive by paste rather than by `type`, because `user-event` reads `[`
 * and `{` in typed text as key descriptors - and every value here is JSON.
 */

const SAMPLES: TestCase[] = [{ args: [[4, 9], 13], expected: [0, 1] }];
const OPERATIONS_SAMPLES: TestCase[] = [
  {
    args: [],
    ops: [
      { method: 'push', args: [3] },
      { method: 'smallest', args: [] },
    ],
    expected: [null, 3],
  },
];

function Harness({ samples }: { samples: TestCase[] }) {
  const shape = customTestShapeFrom(samples === SAMPLES ? 'function' : 'operations', samples);
  const [inputs, setInputs] = useState<CustomTestInput[]>([]);
  const parsed = parseCustomTests(inputs, shape);

  return (
    <TestcasePanel
      samples={samples}
      shape={shape}
      inputs={inputs}
      onChange={setInputs}
      issues={parsed.ok ? [] : parsed.issues}
    />
  );
}

describe('samples', () => {
  it('shows each sample with its input and expected output', () => {
    render(<Harness samples={SAMPLES} />);

    expect(screen.getByText('Sample 1')).toBeInTheDocument();
    expect(screen.getByText('[[4,9],13]')).toBeInTheDocument();
    expect(screen.getByText('[0,1]')).toBeInTheDocument();
  });

  it('explains what a custom case is for before there are any', () => {
    render(<Harness samples={SAMPLES} />);

    expect(screen.getByText(/without deciding whether it is right/)).toBeInTheDocument();
  });
});

describe('adding a case', () => {
  it('opens one box per argument, prefilled from the first sample', async () => {
    render(<Harness samples={SAMPLES} />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Add a case' }));

    expect(screen.getByLabelText('Argument 1')).toHaveValue('[4,9]');
    expect(screen.getByLabelText('Argument 2')).toHaveValue('13');
  });

  it('marks an argument that is not valid JSON, and says why', async () => {
    const user = userEvent.setup();
    render(<Harness samples={SAMPLES} />);
    await user.click(screen.getByRole('button', { name: 'Add a case' }));

    const field = screen.getByLabelText('Argument 1');
    await user.clear(field);
    await user.paste('[4, 9');

    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/Argument 1 is not valid JSON/)).toBeInTheDocument();
    // The message is wired to the box it belongs to, not just printed near it.
    expect(field).toHaveAccessibleDescription(expect.stringContaining('not valid JSON'));
  });

  it('accepts a valid case and stops complaining', async () => {
    const user = userEvent.setup();
    render(<Harness samples={SAMPLES} />);
    await user.click(screen.getByRole('button', { name: 'Add a case' }));

    const field = screen.getByLabelText('Argument 1');
    await user.clear(field);
    await user.paste('[1,2,3]');

    expect(field).not.toHaveAttribute('aria-invalid');
  });

  it('removes a case again', async () => {
    const user = userEvent.setup();
    render(<Harness samples={SAMPLES} />);
    await user.click(screen.getByRole('button', { name: 'Add a case' }));
    await user.click(screen.getByRole('button', { name: 'Remove' }));

    expect(screen.queryByLabelText('Argument 1')).not.toBeInTheDocument();
  });
});

describe('operations problems', () => {
  it('asks for a call list and rejects a method the problem does not have', async () => {
    const user = userEvent.setup();
    render(<Harness samples={OPERATIONS_SAMPLES} />);
    await user.click(screen.getByRole('button', { name: 'Add a case' }));

    const calls = screen.getByLabelText(/Calls/);
    await user.clear(calls);
    await user.paste('[["shove", [1]]]');

    expect(screen.getByText(/this problem has no method "shove"/)).toBeInTheDocument();
  });
});
