import { Route, Routes } from 'react-router-dom';
import { AppShell } from './app/AppShell.js';
import { KitchenSink } from './dev/KitchenSink.js';
import { Interview } from './screens/Interview.js';
import { Progress } from './screens/Progress.js';
import { Settings } from './screens/settings/Settings.js';
import { ProblemList } from './screens/problems/ProblemList.js';
import { Workspace } from './screens/workspace/Workspace.js';
import { ShortcutProvider } from './shortcuts/ShortcutProvider.js';
import { TooltipProvider } from './ui/index.js';

/**
 * Routes (ROADMAP P4-2).
 *
 * Five screens under one shell, and the shell is a layout route rather than
 * something each screen renders: the top bar must not blink out and back while
 * the workspace loads a problem.
 *
 * `/dev/kitchen-sink` is the token reference page and exists in development
 * only, deliberately outside the shell - it is a page about the design system,
 * not a place in the app.
 */
export function App() {
  return (
    <TooltipProvider>
      <ShortcutProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<ProblemList />} />
            <Route path="/problems/:slug" element={<Workspace />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/interview" element={<Interview />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<p className="text-fg-muted p-6 text-sm">No such page.</p>} />
          </Route>
          {import.meta.env.DEV && <Route path="/dev/kitchen-sink" element={<KitchenSink />} />}
        </Routes>
      </ShortcutProvider>
    </TooltipProvider>
  );
}
