import * as RadixAlertDialog from '@radix-ui/react-alert-dialog';
import type { ReactNode } from 'react';
import { Button } from './Button.js';

/**
 * A confirmation before something destroys work (ROADMAP P4-6).
 *
 * Radix's *alert* dialog rather than its plain one, and the difference is not
 * cosmetic: an alert dialog is announced as one, cannot be dismissed by clicking
 * outside it, and puts initial focus on Cancel. All three are what you want in
 * front of "this deletes what you have written".
 *
 * Promoted to `src/ui/` the moment it has a second caller (docs/DESIGN.md
 * section 7); today reset-to-starter is the only thing in the app that throws
 * away the user's code, but Settings' reset-all-progress is the next one and it
 * is P3-4's route already waiting for a screen.
 */

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** What will be lost, in a sentence. Not a warning triangle. */
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <RadixAlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixAlertDialog.Portal>
        {/* The scrim is a token, not a raw colour (docs/DESIGN.md item 1). */}
        <RadixAlertDialog.Overlay className="bg-overlay-scrim fixed inset-0 z-50" />
        <RadixAlertDialog.Content
          className={[
            'bg-surface-raised border-border shadow-overlay fixed top-1/2 left-1/2 z-50',
            'w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2',
            'rounded-lg border p-4',
          ].join(' ')}
        >
          <RadixAlertDialog.Title className="text-fg text-sm font-semibold">
            {title}
          </RadixAlertDialog.Title>
          <RadixAlertDialog.Description className="text-fg-muted mt-2 text-sm">
            {description}
          </RadixAlertDialog.Description>

          <div className="mt-4 flex justify-end gap-2">
            <RadixAlertDialog.Cancel asChild>
              <Button variant="secondary">Cancel</Button>
            </RadixAlertDialog.Cancel>
            <RadixAlertDialog.Action asChild>
              <Button variant="danger" onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </RadixAlertDialog.Action>
          </div>
        </RadixAlertDialog.Content>
      </RadixAlertDialog.Portal>
    </RadixAlertDialog.Root>
  );
}
