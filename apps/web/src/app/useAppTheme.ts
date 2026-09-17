import { useEffect, useState } from 'react';
import type { Theme } from '@devpromax/shared';
import { useSettings, useUpdateSettings } from '../api/hooks.js';
import { applyTheme, cacheTheme, cachedTheme } from '../theme.js';

/**
 * The theme, from settings to the `<html>` attribute (ROADMAP P4-2).
 *
 * The chosen theme is a server setting, so it survives a new browser and shows
 * up on the settings screen with everything else. But the server is a fetch
 * away, and repainting the whole app once the answer arrives is exactly the
 * flash this avoids: `main.tsx` applies the cached value before React mounts,
 * this reconciles it, and the two only differ on the first load after a change
 * made in another window.
 *
 * Returns the value to show in the control, which is the server's once it is
 * known and the cache's until then - never a third, resolved value, because the
 * control has to be able to show `System` as selected.
 */
export function useAppTheme(): {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  saving: boolean;
} {
  const { data: settings } = useSettings();
  const update = useUpdateSettings();

  const theme = settings?.theme ?? cachedTheme();

  useEffect(() => {
    applyTheme(theme);
    cacheTheme(theme);
  }, [theme]);

  return {
    theme,
    setTheme: (next) => {
      // Applied before the request, not after it. The user asked for a theme,
      // not for a theme if the write succeeds, and a round trip's worth of delay
      // on a colour change reads as a broken button.
      applyTheme(next);
      cacheTheme(next);
      update.mutate({ theme: next });
    },
    saving: update.isPending,
  };
}

/**
 * The theme as an actual colour, for the things that cannot take `system`.
 *
 * Monaco is the one that matters: it is not styled by our CSS at all, so it has
 * to be handed `vs` or `vs-dark` by name. The media query is *subscribed to*
 * rather than read once, so an editor open across the OS's sunset switch follows
 * the rest of the app instead of staying light on a dark page.
 */
export function useResolvedTheme(): 'light' | 'dark' {
  const { data: settings } = useSettings();
  const choice = settings?.theme ?? cachedTheme();

  const [systemDark, setSystemDark] = useState(
    () => globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false,
  );

  useEffect(() => {
    const query = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
    if (!query) return;
    const onChange = (event: MediaQueryListEvent) => {
      setSystemDark(event.matches);
    };
    query.addEventListener('change', onChange);
    return () => {
      query.removeEventListener('change', onChange);
    };
  }, []);

  if (choice === 'system') return systemDark ? 'dark' : 'light';
  return choice;
}
