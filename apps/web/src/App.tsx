import { KitchenSink } from './dev/KitchenSink.js';
import { TooltipProvider } from './ui/index.js';

/** Dev-only reference page for the design tokens (ROADMAP P0-8). */
const KITCHEN_SINK_PATH = '/dev/kitchen-sink';

export function App() {
  // A pathname check rather than a router: routing is P4-2's, and one dev page
  // is not a reason to stand up React Router and then have it rewritten. It is
  // also gated on DEV, so the dev page is not in the production bundle at all.
  const showKitchenSink =
    import.meta.env.DEV && globalThis.location?.pathname === KITCHEN_SINK_PATH;

  return (
    <TooltipProvider>
      {showKitchenSink ? (
        <KitchenSink />
      ) : (
        <main className="mx-auto max-w-2xl px-6 py-12">
          <h1 className="text-xl font-semibold">DevProMax</h1>
          <p className="text-fg-muted mt-1 text-sm">Scaffold only. Screens arrive with P4.</p>
          {import.meta.env.DEV && (
            <p className="mt-6 text-sm">
              <a
                className="text-accent-fg focus-ring rounded-xs underline"
                href={KITCHEN_SINK_PATH}
              >
                Design tokens and primitives
              </a>
            </p>
          )}
        </main>
      )}
    </TooltipProvider>
  );
}
