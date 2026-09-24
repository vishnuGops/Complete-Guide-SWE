import { Suspense, lazy, type ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppShell } from './app/AppShell.js';
import { NotFound } from './app/NotFound.js';
import { ProblemList } from './screens/problems/ProblemList.js';
import { WorkspaceSkeleton } from './screens/workspace/WorkspaceSkeleton.js';
import { ShortcutProvider } from './shortcuts/ShortcutProvider.js';
import { Loading, TooltipProvider } from './ui/index.js';

/**
 * Routes (ROADMAP P4-2).
 *
 * Five screens under one shell, and the shell is a layout route rather than
 * something each screen renders: the rail must not blink out and back while
 * the workspace loads a problem.
 *
 * `/dev/kitchen-sink` is the token reference page and exists in development
 * only, deliberately outside the shell - it is a page about the design system,
 * not a place in the app.
 *
 * Every screen but the list is a lazy chunk (ROADMAP P4-18). The list is where
 * the app opens, so it stays in the entry; the others brought the markdown
 * pipeline, the highlighter, the chart and the coach's panels into a first
 * paint that shows none of them - 854 KB of entry, and a workspace that missed
 * its Lighthouse budget waiting for code the list page had already parsed. A
 * chunk that fails to load is caught by the shell's error boundary, which
 * offers the reload that fixes a stale one.
 */

const Workspace = lazy(() =>
  import('./screens/workspace/Workspace.js').then((module) => ({ default: module.Workspace })),
);
const Progress = lazy(() =>
  import('./screens/progress/Progress.js').then((module) => ({ default: module.Progress })),
);
const Interview = lazy(() =>
  import('./screens/interview/Interview.js').then((module) => ({ default: module.Interview })),
);
const Settings = lazy(() =>
  import('./screens/settings/Settings.js').then((module) => ({ default: module.Settings })),
);
const KitchenSink = lazy(() =>
  import('./dev/KitchenSink.js').then((module) => ({ default: module.KitchenSink })),
);

/**
 * What shows while a screen's chunk downloads: nothing to look at, something
 * to hear. Each screen draws its own skeleton the moment it runs, so a second,
 * generic one here would only be a different grey shape for a few frames.
 */
function ScreenLoading() {
  return (
    <Loading label="Loading" className="h-full">
      {null}
    </Loading>
  );
}

function Lazy({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return <Suspense fallback={fallback ?? <ScreenLoading />}>{children}</Suspense>;
}

export function App() {
  return (
    <TooltipProvider>
      <ShortcutProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<ProblemList />} />
            <Route
              path="/problems/:slug"
              element={
                // The workspace's own skeleton, which is in the entry for this:
                // the chunk and the problem arrive one after the other, and
                // one skeleton across both is one layout rather than two.
                <Lazy fallback={<WorkspaceSkeleton />}>
                  <Workspace />
                </Lazy>
              }
            />
            <Route
              path="/progress"
              element={
                <Lazy>
                  <Progress />
                </Lazy>
              }
            />
            <Route
              path="/interview"
              element={
                <Lazy>
                  <Interview />
                </Lazy>
              }
            />
            <Route
              path="/settings"
              element={
                <Lazy>
                  <Settings />
                </Lazy>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Route>
          {import.meta.env.DEV && (
            <Route
              path="/dev/kitchen-sink"
              element={
                <Lazy>
                  <KitchenSink />
                </Lazy>
              }
            />
          )}
        </Routes>
      </ShortcutProvider>
    </TooltipProvider>
  );
}
