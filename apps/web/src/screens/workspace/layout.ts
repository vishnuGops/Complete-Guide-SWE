import { useCallback, useState } from 'react';

/**
 * Where the workspace's panes sit (ROADMAP P4-6).
 *
 * In `localStorage` rather than in settings, and that is a deliberate split: the
 * database holds preferences that describe the user (font size, tab width, which
 * language they last used), and this describes the window they happen to have
 * open. Syncing a pixel ratio through an HTTP round trip on every drag would be
 * a write per frame for a value that means nothing on another screen.
 */

const KEY = 'devpromax.workspace.layout';

export interface WorkspaceLayout {
  /** Percentage of the width given to the statement panel. */
  statement: number;
  /** Percentage of the editor column's height given to the editor. */
  editor: number;
  /** `Ctrl+J` collapses the bottom panel to its tab strip. */
  panelCollapsed: boolean;
}

const DEFAULT_LAYOUT: WorkspaceLayout = {
  statement: 40,
  editor: 62,
  panelCollapsed: false,
};

function read(): WorkspaceLayout {
  try {
    const stored = globalThis.localStorage?.getItem(KEY);
    if (!stored) return DEFAULT_LAYOUT;
    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_LAYOUT;

    // Read field by field: a layout written by an older version is worth
    // keeping the usable half of, and a corrupt one must not white-screen the
    // only screen in the app that matters.
    const value = parsed as Partial<Record<keyof WorkspaceLayout, unknown>>;
    return {
      statement: typeof value.statement === 'number' ? value.statement : DEFAULT_LAYOUT.statement,
      editor: typeof value.editor === 'number' ? value.editor : DEFAULT_LAYOUT.editor,
      panelCollapsed:
        typeof value.panelCollapsed === 'boolean'
          ? value.panelCollapsed
          : DEFAULT_LAYOUT.panelCollapsed,
    };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export function useWorkspaceLayout(): [WorkspaceLayout, (patch: Partial<WorkspaceLayout>) => void] {
  const [layout, setLayout] = useState(read);

  const update = useCallback((patch: Partial<WorkspaceLayout>) => {
    setLayout((previous) => {
      const next = { ...previous, ...patch };
      try {
        globalThis.localStorage?.setItem(KEY, JSON.stringify(next));
      } catch {
        // Not being able to remember the layout is not a reason to refuse to
        // change it for this session.
      }
      return next;
    });
  }, []);

  return [layout, update];
}
