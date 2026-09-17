import { Route, Routes } from 'react-router-dom';
import { KitchenSink } from './dev/KitchenSink.js';
import { ProblemList } from './screens/ProblemList.js';
import { Workspace } from './screens/Workspace.js';
import { TooltipProvider } from './ui/index.js';

/**
 * Routes (ROADMAP P4-1).
 *
 * Two real screens and, in development only, the token reference page. The app
 * shell around them - top bar, theme toggle, global progress, the shortcut
 * registry and the /progress and /settings routes - is P4-2's.
 */
export function App() {
  return (
    <TooltipProvider>
      <Routes>
        <Route path="/" element={<ProblemList />} />
        <Route path="/problems/:slug" element={<Workspace />} />
        {import.meta.env.DEV && <Route path="/dev/kitchen-sink" element={<KitchenSink />} />}
        <Route path="*" element={<p className="text-fg-muted p-6 text-sm">No such page.</p>} />
      </Routes>
    </TooltipProvider>
  );
}
