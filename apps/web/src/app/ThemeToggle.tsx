import { THEMES, type Theme } from '@devpromax/shared';
import { Segmented } from '../ui/index.js';

const THEME_LABEL: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

/**
 * The theme control (ROADMAP P4-2, D16; a segmented control since P9-6).
 *
 * Three labelled segments rather than a sun/moon that toggles, because there
 * are genuinely three states and the third one - follow the OS - is the
 * default. A two-state toggle has to either hide `system` or pretend the
 * current resolved value is a choice the user made, and then "why did it change
 * at sunset" has no answer on screen.
 *
 * Labels, not icons: a row of unlabelled glyphs is a memory test
 * (docs/DESIGN.md 3).
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
    <Segmented
      label="Theme"
      size="sm"
      options={THEMES.map((theme) => ({ value: theme, label: THEME_LABEL[theme], disabled }))}
      value={value}
      onChange={onChange}
    />
  );
}
