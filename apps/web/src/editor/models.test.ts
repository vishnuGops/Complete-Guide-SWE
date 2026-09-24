import { describe, expect, it, vi } from 'vitest';
import { disposeStaleModels, syncMountedValue, type ModelLike } from './models.js';

/**
 * Monaco model housekeeping (ROADMAP P4-15).
 *
 * Against fakes with the handful of methods the helpers call: Monaco itself
 * cannot run in jsdom, and what is under test is which models go and which
 * value wins, not Monaco.
 */

function aModel(path: string): ModelLike & { dispose: ReturnType<typeof vi.fn> } {
  let disposed = false;
  return {
    // Monaco parses `two-sum.python` into a URI whose path has a leading slash.
    uri: { path: `/${path}` },
    isDisposed: () => disposed,
    dispose: vi.fn(() => {
      disposed = true;
    }),
  };
}

describe('disposeStaleModels', () => {
  it('disposes other problems’ models and keeps this problem’s languages', () => {
    const showing = aModel('two-sum.python');
    const otherLanguage = aModel('two-sum.java');
    const lastProblem = aModel('merge-intervals.python');
    const olderStill = aModel('merge-intervals.java');

    const disposed = disposeStaleModels(
      {
        editor: {
          getModels: () => [showing, otherLanguage, lastProblem, olderStill],
          getEditors: () => [{ getModel: () => showing }],
        },
      },
      'two-sum.python',
    );

    expect(disposed).toBe(2);
    expect(lastProblem.dispose).toHaveBeenCalledOnce();
    expect(olderStill.dispose).toHaveBeenCalledOnce();
    // The other language keeps its undo history for the switch back.
    expect(otherLanguage.dispose).not.toHaveBeenCalled();
    expect(showing.dispose).not.toHaveBeenCalled();
  });

  it('never disposes a model some editor is showing', () => {
    const elsewhere = aModel('merge-intervals.python');

    disposeStaleModels(
      {
        editor: {
          getModels: () => [elsewhere],
          getEditors: () => [{ getModel: () => elsewhere }],
        },
      },
      'two-sum.python',
    );

    expect(elsewhere.dispose).not.toHaveBeenCalled();
  });
});

describe('syncMountedValue', () => {
  it('replaces what a model kept from an earlier visit with the workspace’s value', () => {
    let text = 'code from last time';
    const editor = {
      getValue: () => text,
      setValue: vi.fn((value: string) => {
        text = value;
      }),
    };

    expect(syncMountedValue(editor, 'the saved draft')).toBe(true);
    expect(text).toBe('the saved draft');
  });

  it('leaves an editor that already agrees alone, undo history and all', () => {
    const editor = { getValue: () => 'same', setValue: vi.fn() };

    expect(syncMountedValue(editor, 'same')).toBe(false);
    expect(editor.setValue).not.toHaveBeenCalled();
  });
});
