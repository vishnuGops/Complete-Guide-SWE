import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { matchShortcut, type ShortcutId } from './shortcuts.js';

/**
 * The shortcut registry (ROADMAP P4-2).
 *
 * One listener for the whole app, and screens declare what they want rather than
 * each adding a listener of their own. Three things make that worth a provider:
 *
 *   - **It listens in the capture phase, on the window.** Monaco stops
 *     propagation of the keys it handles, so a bubbling listener never sees a
 *     `Ctrl+Enter` pressed inside the editor - which is the only place the user
 *     will ever press it. Capture runs before Monaco gets the event.
 *   - **The last registration wins.** A shortcut means whatever the screen the
 *     user is looking at says it means, and screens mount and unmount; a `Set`
 *     of handlers would fire a stale one alongside the live one.
 *   - **Unclaimed shortcuts stay unclaimed.** `Ctrl+J` opens the browser's
 *     downloads; we only take it when something is actually listening, so the
 *     list page does not silently break a browser binding it has no use for.
 */

type Handler = () => void;

interface Registry {
  register: (id: ShortcutId, handler: Handler) => () => void;
}

const ShortcutContext = createContext<Registry | null>(null);

export function ShortcutProvider({ children }: { children: ReactNode }) {
  // A ref rather than state: registering a handler must not re-render the app,
  // and the listener below has to read the current stack, not the one that
  // existed when it was attached.
  const stacks = useRef(new Map<ShortcutId, Handler[]>());

  const registry = useMemo<Registry>(
    () => ({
      register(id, handler) {
        const stack = stacks.current.get(id) ?? [];
        stack.push(handler);
        stacks.current.set(id, stack);

        return () => {
          const current = stacks.current.get(id);
          if (!current) return;
          const at = current.lastIndexOf(handler);
          if (at !== -1) current.splice(at, 1);
        };
      },
    }),
    [],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat) return;
      const shortcut = matchShortcut(event);
      if (!shortcut) return;

      const stack = stacks.current.get(shortcut.id);
      const handler = stack?.at(-1);
      if (!handler) return;

      // Only once we know something will act on it: `Ctrl+J` is the browser's
      // downloads panel everywhere else.
      event.preventDefault();
      event.stopPropagation();
      handler();
    }

    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
    };
  }, []);

  return <ShortcutContext.Provider value={registry}>{children}</ShortcutContext.Provider>;
}

/**
 * Binds one shortcut for as long as the component is mounted.
 *
 * `enabled` exists because the alternative is a handler that checks whether it
 * should have run. A Run shortcut pressed while a run is in flight should do
 * nothing *and* leave `Ctrl+Enter` alone, which is not the same as firing a
 * handler that returns early.
 */
export function useShortcut(id: ShortcutId, handler: Handler, enabled = true): void {
  const registry = useContext(ShortcutContext);
  // The handler is re-created every render by every caller; storing it in a ref
  // keeps the registration stable so the stack order is mount order, not the
  // order of the last render.
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });

  useEffect(() => {
    if (!registry || !enabled) return;
    return registry.register(id, () => {
      latest.current();
    });
  }, [registry, id, enabled]);
}
