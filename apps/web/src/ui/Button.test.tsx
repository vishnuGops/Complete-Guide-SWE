import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button.js';

/**
 * What is worth testing about a button is not how it looks - that is what the
 * kitchen sink is for - but the three behaviours that are easy to get wrong and
 * invisible when they are: the implicit `type`, the disabled state actually
 * blocking the handler, and the caller's own classes surviving.
 */

describe('Button', () => {
  it('defaults to type=button, so it cannot submit a form by accident', () => {
    render(<Button>Run</Button>);
    expect(screen.getByRole('button', { name: 'Run' })).toHaveAttribute('type', 'button');
  });

  it('still allows an explicit submit button', () => {
    render(<Button type="submit">Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'submit');
  });

  it('calls its handler on click and on Enter', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Run</Button>);

    // Keyboard first: clicking focuses the button, so tabbing afterwards would
    // move focus off it and the Enter would go nowhere.
    await user.tab();
    await user.keyboard('{Enter}');
    await user.click(screen.getByRole('button'));

    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('does not fire when disabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Run
      </Button>,
    );

    await user.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('keeps the caller’s className, and puts it last so it can win', () => {
    render(<Button className="w-full">Run</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('w-full');
    expect(button.className.trim().endsWith('w-full')).toBe(true);
  });

  it('exposes a ref, which Radix needs to use a Button as a trigger', () => {
    let node: HTMLButtonElement | null = null;
    render(
      <Button
        ref={(element) => {
          node = element;
        }}
      >
        Run
      </Button>,
    );
    expect(node).toBeInstanceOf(HTMLButtonElement);
  });
});
