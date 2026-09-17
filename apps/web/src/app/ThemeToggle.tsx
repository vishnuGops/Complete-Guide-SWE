import { THEMES, type Theme } from '@devpromax/shared';
import { Button, Tooltip } from '../ui/index.js';

const THEME_LABEL: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

/**
 * The theme control (ROADMAP P4-2, D16).
 *
 * Three labelled buttons rather than a sun/moon that toggles, because there are
 * genuinely three states and the third one - follow the OS - is the default. A
 * two-state toggle has to either hide `system` or pretend the current resolved
 * value is a choice the user made, and then "why did it change at sunset" has no
 * answer on screen.
 *
 * Labels, not icons: a row of unlabelled glyphs is a memory test
 * (docs/DESIGN.md section 2).
 */
export function ThemeToggle({
  value,
  onChange,
  disabled = false,
}: {
  value: Theme;
  onChange: (theme: Theme) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5" role="group" aria-label="Theme">
      {THEMES.map((theme) => (
        <Tooltip key={theme} content={`${THEME_LABEL[theme]} theme`}>
          <Button
            size="sm"
            variant={value === theme ? 'secondary' : 'ghost'}
            aria-pressed={value === theme}
            disabled={disabled}
            onClick={() => {
              onChange(theme);
            }}
          >
            {THEME_LABEL[theme]}
          </Button>
        </Tooltip>
      ))}
    </div>
  );
}
