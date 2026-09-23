import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ListChecks } from 'lucide-react';
import { Card } from './Card.js';
import { Keys } from './Kbd.js';
import { RailItem } from './RailItem.js';
import { SegmentBar } from './SegmentBar.js';
import { Segmented } from './Segmented.js';
import { StatusMark } from './StatusMark.js';
import { TooltipProvider } from './Tooltip.js';

/**
 * The primitives design version 2 added (ROADMAP P9-6).
 *
 * What is tested is behaviour a screen relies on, not the look: which segment
 * is pressed and how the keyboard moves between them, that a titled card is a
 * named region, that the status marks differ in shape as well as colour, and
 * that the rail says where you are.
 */

function Language() {
  const [value, setValue] = useState<'python' | 'java'>('python');
  return (
    <Segmented
      label="Language"
      options={[
        { value: 'python', label: 'Python' },
        { value: 'java', label: 'Java' },
      ]}
      value={value}
      onChange={setValue}
    />
  );
}

describe('Segmented', () => {
  it('is a named group of toggle buttons with one pressed', async () => {
    render(<Language />);
    const group = screen.getByRole('group', { name: 'Language' });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Python' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Java' })).toHaveAttribute('aria-pressed', 'false');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Java' }));
    expect(screen.getByRole('button', { name: 'Java' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('moves between segments with the arrow keys, wrapping at the ends', async () => {
    const user = userEvent.setup();
    render(<Language />);
    screen.getByRole('button', { name: 'Python' }).focus();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'Java' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'Python' })).toHaveFocus();
    // Moving focus is not choosing: the choice is still the first one.
    expect(screen.getByRole('button', { name: 'Python' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('skips a disabled segment', async () => {
    const user = userEvent.setup();
    render(
      <Segmented
        label="Range"
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B', disabled: true },
          { value: 'c', label: 'C' },
        ]}
        value="a"
        onChange={() => undefined}
      />,
    );
    screen.getByRole('button', { name: 'A' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'C' })).toHaveFocus();
  });
});

describe('Card', () => {
  it('is a region named by its title', () => {
    render(<Card title="Review queue">Nothing due.</Card>);
    expect(screen.getByRole('region', { name: 'Review queue' })).toHaveTextContent('Nothing due.');
    expect(screen.getByRole('heading', { name: 'Review queue', level: 2 })).toBeInTheDocument();
  });
});

describe('StatusMark', () => {
  it('draws each status as a different shape, so colour is never alone', () => {
    const { container } = render(
      <>
        <StatusMark status="not_started" />
        <StatusMark status="in_progress" />
        <StatusMark status="solved" />
        <StatusMark status="mastered" />
      </>,
    );
    const shapes = [...container.querySelectorAll('svg[data-status]')].map((svg) => svg.innerHTML);
    expect(new Set(shapes).size).toBe(4);
  });
});

describe('RailItem', () => {
  function rail(path: string) {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <TooltipProvider>
          <RailItem to="/" label="Problems" icon={ListChecks} activeUnder={['/problems/']} />
        </TooltipProvider>
      </MemoryRouter>,
    );
  }

  it('is the current page on its own path', () => {
    rail('/');
    expect(screen.getByRole('link', { name: 'Problems' })).toHaveAttribute('aria-current', 'page');
  });

  it('is still the current page inside a problem', () => {
    rail('/problems/pair-sum-index');
    expect(screen.getByRole('link', { name: 'Problems' })).toHaveAttribute('aria-current', 'page');
  });

  it('is not current anywhere else', () => {
    rail('/settings');
    expect(screen.getByRole('link', { name: 'Problems' })).not.toHaveAttribute('aria-current');
  });
});

describe('Keys and SegmentBar', () => {
  it('keeps key chips out of the accessible name of the control they sit in', () => {
    render(
      <button type="button">
        AI Help <Keys keys={['Ctrl', 'Shift', 'H']} />
      </button>,
    );
    expect(screen.getByRole('button', { name: 'AI Help' })).toBeInTheDocument();
  });

  it('is a picture unless it is given a name', () => {
    const { container, rerender } = render(<SegmentBar filled={2} total={5} />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    rerender(<SegmentBar filled={2} total={5} label="2 of 5 solved" />);
    expect(screen.getByRole('img', { name: '2 of 5 solved' })).toBeInTheDocument();
  });
});
