import { useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Braces, ChartLine, ListChecks, MessagesSquare, Settings } from 'lucide-react';
import { useShortcut } from '../shortcuts/ShortcutProvider.js';
import { ErrorBoundary, RailItem } from '../ui/index.js';
import { CommandPalette } from './CommandPalette.js';
import { ShellProvider } from './PageHeader.js';
import { Welcome } from './Welcome.js';
import { useAppTheme } from './useAppTheme.js';

/**
 * The frame every screen sits in (ROADMAP P4-2; rebuilt as a rail by P9-6).
 *
 * A 64px icon rail on the left, a card of its own on the canvas, and the page
 * beside it. The rail holds the one thing that is true on every screen - where
 * you are - and each page draws its own header (`PageHeader`), because the
 * title and the line of context under it belong to the page. The top bar this
 * replaces held the same places in a row across the top; moving them to the
 * side gives the workspace back its height, which is the dimension an editor
 * and a results panel compete for (docs/DESIGN.md 8).
 *
 * The theme choice lives in Settings rather than in the chrome: the header has
 * room for what is used on every visit, and the theme is chosen once.
 *
 * The whole shell is `h-screen` with `min-h-0` bodies, which is what lets the
 * workspace's own cards scroll independently instead of the page growing a
 * scrollbar and pushing the editor off the bottom.
 */
export function AppShell() {
  // Applies the stored theme to the document; the control is in Settings.
  useAppTheme();

  /*
   * The palette lives here rather than on a screen (ROADMAP P7-7): `Ctrl+K` has
   * to work from the workspace, the list and the settings alike, and a copy per
   * screen would be three dialogs that could disagree. Each page's search pill
   * reaches it through the shell context.
   */
  const [palette, setPalette] = useState(false);
  useShortcut('commandPalette', () => {
    setPalette(true);
  });
  const shell = useMemo(
    () => ({
      openPalette: () => {
        setPalette(true);
      },
    }),
    [],
  );

  return (
    <ShellProvider value={shell}>
      <div className="flex h-screen max-[1023px]:hidden">
        <nav
          aria-label="Main"
          className="bg-surface border-border shadow-card my-4 ml-4 flex w-16 shrink-0 flex-col items-center gap-2 rounded-xl border py-3"
        >
          {/* The mark, not a link: Problems is the way home, and two links to one place is one too many. */}
          <span
            aria-hidden
            className="bg-surface-sunken text-fg border-border mb-3 grid size-9 place-items-center rounded-lg border"
          >
            <Braces size={18} strokeWidth={2} />
          </span>
          <RailItem to="/" label="Problems" icon={ListChecks} activeUnder={['/problems/']} />
          <RailItem to="/progress" label="Progress" icon={ChartLine} />
          <RailItem to="/interview" label="Interview" icon={MessagesSquare} />
          <div className="mt-auto">
            <RailItem to="/settings" label="Settings" icon={Settings} />
          </div>
        </nav>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/*
            A screen that throws must not take the app with it (P4-12). Inside the
            shell rather than around it, so the rail - and with it the way out
            to another screen - survives.
          */}
          <ErrorBoundary title="This screen stopped working.">
            {/*
              Above the outlet (P8-3): the welcome is about the app rather than
              about one screen, and it takes itself off the page for good once
              it has been read.
            */}
            <div className="flex h-full min-h-0 flex-col">
              <Welcome />
              <div className="min-h-0 flex-1">
                <Outlet />
              </div>
            </div>
          </ErrorBoundary>
        </main>
      </div>

      <CommandPalette open={palette} onOpenChange={setPalette} />

      {/*
        The 1024px floor (ROADMAP P4-10, docs/DESIGN.md 11).

        Below it the workspace stops being a workspace: a statement, an editor
        and a results panel cannot all be useful in 800px, and the honest answer
        is to say so rather than reflow into a phone layout nobody will practise
        algorithms on.

        Done in CSS rather than by measuring the window, so there is no resize
        listener, no state, and nothing to be wrong on the first paint. The two
        halves are `display: none` in turn, so whichever is hidden is out of the
        accessibility tree as well as off the screen.
      */}
      <div className="hidden h-screen place-content-center p-8 max-[1023px]:grid">
        <div className="bg-surface border-border shadow-card max-w-prose rounded-xl border p-5">
          <h1 className="text-md font-semibold">This window is too narrow.</h1>
          <p className="text-fg-muted mt-2 text-sm">
            DevProMax needs about 1024px of width: the workspace puts a problem statement, an editor
            and the judge&rsquo;s results on screen at once, and below that they stop being readable
            rather than merely tight. Widen the window and it comes back.
          </p>
        </div>
      </div>
    </ShellProvider>
  );
}
