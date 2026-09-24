import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button.js';
import { ConfirmDialog } from './ConfirmDialog.js';

/**
 * The confirmation in front of anything destructive (ROADMAP P4-6).
 *
 * Opened from the caller's state rather than a Radix `Trigger`, which is the
 * case Radix does not return focus for (P4-17).
 */

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        onClick={() => {
          setOpen(true);
        }}
      >
        Reset
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Reset?"
        description="It goes."
        confirmLabel="Delete"
        onConfirm={() => {
          setOpen(false);
        }}
      />
    </>
  );
}

describe('ConfirmDialog', () => {
  it.each(['Cancel', 'Delete'])('gives focus back to what opened it, after %s', async (name) => {
    render(<Harness />);
    const user = userEvent.setup();
    const opener = screen.getByRole('button', { name: 'Reset' });

    await user.click(opener);
    await user.click(await screen.findByRole('button', { name }));

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
    expect(opener).toHaveFocus();
  });
});
