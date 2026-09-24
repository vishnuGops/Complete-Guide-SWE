import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SplitPane } from './SplitPane.js';

/**
 * The splitter (ROADMAP P4-6; drag reporting by P4-18).
 *
 * jsdom has no layout, so the container is given a box by hand: 1000px wide
 * from x = 0, which makes a pointer at x = 300 a 30% split.
 */

function renderSplit(onRatio: (ratio: number) => void) {
  render(
    <SplitPane
      direction="row"
      ratio={40}
      onRatio={onRatio}
      label="Statement and editor"
      first={<p>left</p>}
      second={<p>right</p>}
    />,
  );
  const handle = screen.getByRole('separator', { name: 'Statement and editor' });
  vi.spyOn(handle.parentElement!, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 1000,
    height: 600,
  } as DOMRect);
  return handle;
}

describe('SplitPane', () => {
  it('reports a drag once, when it ends, and follows the pointer meanwhile', () => {
    const onRatio = vi.fn();
    const handle = renderSplit(onRatio);

    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 400 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 350 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 300 });

    // Every move used to be a layout write and a workspace render.
    expect(onRatio).not.toHaveBeenCalled();
    expect(handle).toHaveAttribute('aria-valuenow', '30');

    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 300 });
    expect(onRatio).toHaveBeenCalledTimes(1);
    expect(onRatio).toHaveBeenCalledWith(30);
  });

  it('ignores a pointer that moves without having been pressed', () => {
    const onRatio = vi.fn();
    const handle = renderSplit(onRatio);

    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 300 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 300 });

    expect(onRatio).not.toHaveBeenCalled();
    expect(handle).toHaveAttribute('aria-valuenow', '40');
  });

  it('still moves by keyboard straight away', () => {
    const onRatio = vi.fn();
    const handle = renderSplit(onRatio);

    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(onRatio).toHaveBeenCalledWith(42);
  });
});
