import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button.js';
import { Tooltip, TooltipProvider } from './Tooltip.js';

/**
 * The point of these: a tooltip that only answers to a mouse is a tooltip half
 * the shortcuts in this app are invisible behind (D16). Keyboard focus must open
 * it, Escape must close it, and it must be the trigger's accessible description
 * rather than text floating unattached.
 */

function Fixture({ content = 'Run against the samples' } = {}) {
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip content={content} keys={['Ctrl', 'Enter']}>
        <Button>Run</Button>
      </Tooltip>
    </TooltipProvider>
  );
}

describe('Tooltip', () => {
  it('stays closed until something asks for it', () => {
    render(<Fixture />);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('opens on keyboard focus', async () => {
    const user = userEvent.setup();
    render(<Fixture />);

    await user.tab();
    expect(screen.getByRole('button', { name: /Run/ })).toHaveFocus();
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Run against the samples');
  });

  it('describes its trigger, so a screen reader announces it with the button', async () => {
    const user = userEvent.setup();
    render(<Fixture />);

    await user.tab();
    await screen.findByRole('tooltip');
    expect(screen.getByRole('button', { name: /Run/ })).toHaveAccessibleDescription(
      /Run against the samples/,
    );
  });

  it('closes on Escape without moving focus', async () => {
    const user = userEvent.setup();
    render(<Fixture />);

    await user.tab();
    await screen.findByRole('tooltip');
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Run/ })).toHaveFocus();
  });

  it('renders the shortcut keys beside the label', async () => {
    const user = userEvent.setup();
    render(<Fixture />);

    await user.tab();
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Ctrl');
    expect(tooltip).toHaveTextContent('Enter');
  });
});
