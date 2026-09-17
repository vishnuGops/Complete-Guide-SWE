import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './Tabs.js';

/**
 * These assertions are about the contract we are buying from Radix (D16:
 * accessibility without an imposed look). They are worth keeping because the
 * failure mode of styling a Radix primitive is breaking exactly this - a
 * `div` in the wrong place, a stray `tabIndex` - and the app would still look
 * right while being unusable from the keyboard.
 */

function Fixture() {
  return (
    <Tabs defaultValue="description">
      <TabsList>
        <TabsTrigger value="description">Description</TabsTrigger>
        <TabsTrigger value="hints">Hints</TabsTrigger>
        <TabsTrigger value="editorial" disabled>
          Editorial
        </TabsTrigger>
        <TabsTrigger value="notes">Notes</TabsTrigger>
      </TabsList>
      <TabsContent value="description">The problem statement.</TabsContent>
      <TabsContent value="hints">One rung at a time.</TabsContent>
      <TabsContent value="editorial">The approach.</TabsContent>
      <TabsContent value="notes">Your notes.</TabsContent>
    </Tabs>
  );
}

describe('Tabs', () => {
  it('shows the default panel and only that panel', () => {
    render(<Fixture />);

    expect(screen.getByText('The problem statement.')).toBeVisible();
    expect(screen.queryByText('One rung at a time.')).not.toBeInTheDocument();
  });

  it('is a tablist whose panel is labelled by its tab', () => {
    render(<Fixture />);

    expect(screen.getByRole('tablist')).toBeInTheDocument();
    const selected = screen.getByRole('tab', { selected: true });
    expect(selected).toHaveTextContent('Description');
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Description');
  });

  it('moves between tabs with the arrow keys', async () => {
    const user = userEvent.setup();
    render(<Fixture />);

    await user.tab(); // into the tab list, which holds one tab stop
    expect(screen.getByRole('tab', { name: 'Description' })).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Hints');
    expect(screen.getByText('One rung at a time.')).toBeVisible();
  });

  it('skips a disabled tab instead of landing on it', async () => {
    const user = userEvent.setup();
    render(<Fixture />);

    await user.tab();
    await user.keyboard('{ArrowRight}{ArrowRight}');

    // Editorial is locked until the problem is solved (P7-2); arrow keys pass
    // over it rather than selecting an empty panel.
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Notes');
  });

  it('activates a tab on click', async () => {
    const user = userEvent.setup();
    render(<Fixture />);

    await user.click(screen.getByRole('tab', { name: 'Notes' }));
    expect(screen.getByText('Your notes.')).toBeVisible();
  });
});
