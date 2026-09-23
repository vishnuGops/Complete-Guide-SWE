/**
 * Monaco's theme, derived from the tokens (ROADMAP P9-6, docs/DESIGN.md 8).
 *
 * Monaco paints its own canvas and knows nothing about CSS variables, so its
 * built-in `vs` / `vs-dark` themes sat in the page like a pasted-in screenshot:
 * a white or #1e1e1e rectangle inside a card of a slightly different colour,
 * and keywords in Monaco's blue - which since P9-6 is also the accent's blue,
 * so every `if` and `return` would have read as "this is the action".
 *
 * So the colours are read from the page at the moment the theme is defined:
 * whatever `tokens.css` says `surface` is, the editor's background is. A token
 * change reaches the editor with no second table of colours to keep in step,
 * and so does a proposal previewed by the design skill's `--inject-tokens`.
 *
 * Syntax colour is deliberately sparse, the same scheme highlighted code blocks
 * use in `markdown.css`: keywords in `code-keyword` (violet), comments in
 * `fg-subtle`, strings and numbers in `fg-muted`, everything else `fg`. Monaco's
 * stock palette paints strings red and numbers green, which in this app are the
 * colours of a failed and an accepted verdict.
 */

/** The semantic tokens the editor theme is made of. */
const TOKENS = [
  'surface',
  'surface-sunken',
  'surface-raised',
  'fg',
  'fg-muted',
  'fg-subtle',
  'border',
  'border-strong',
  'accent',
  'accent-subtle',
  'surface-selected',
  'code-keyword',
  'danger',
  'warn',
] as const;

type Token = (typeof TOKENS)[number];
export type EditorPalette = Record<Token, string>;

// ---------------------------------------------------------------------------
// Colour conversion. Monaco wants `#rrggbb`; the page computes OKLCH.
// ---------------------------------------------------------------------------

const clamp = (value: number): number => Math.min(1, Math.max(0, value));

/** Linear-light sRGB channel to the gamma-encoded one. */
function encode(channel: number): number {
  const c = clamp(channel);
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

function hex(red: number, green: number, blue: number, alpha = 1): string {
  const byte = (v: number) =>
    Math.round(clamp(v) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${byte(red)}${byte(green)}${byte(blue)}${alpha < 1 ? byte(alpha) : ''}`;
}

function oklchToHex(lightness: number, chroma: number, hue: number, alpha: number): string {
  const rad = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(rad);
  const b = chroma * Math.sin(rad);
  const long = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const medium = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const short = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return hex(
    encode(4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short),
    encode(-1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short),
    encode(-0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short),
    alpha,
  );
}

/** A number or a percentage, as CSS writes a channel. */
function channel(text: string, percentScale: number): number {
  return text.endsWith('%') ? (Number.parseFloat(text) / 100) * percentScale : Number(text);
}

/**
 * A computed CSS colour as `#rrggbb[aa]`, or undefined when it is not one this
 * understands. Chrome serialises an `oklch()` value as `oklch(...)` and anything
 * written in sRGB as `rgb(...)`, so those two cover the page.
 */
export function cssColorToHex(value: string): string | undefined {
  const text = value.trim().toLowerCase();
  if (text === 'transparent') return '#00000000';

  const oklch =
    /^oklch\(\s*([\d.]+%?)\s+([\d.]+%?)\s+([\d.]+)(?:deg)?\s*(?:\/\s*([\d.]+%?))?\s*\)$/.exec(text);
  if (oklch) {
    const [, l = '0', c = '0', h = '0', alpha] = oklch;
    return oklchToHex(
      channel(l, 1),
      channel(c, 0.4),
      Number(h),
      alpha === undefined ? 1 : channel(alpha, 1),
    );
  }

  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(
    text,
  );
  if (rgb) {
    const [, r = '0', g = '0', b = '0', alpha] = rgb;
    return hex(
      Number(r) / 255,
      Number(g) / 255,
      Number(b) / 255,
      alpha === undefined ? 1 : channel(alpha, 1),
    );
  }
  return undefined;
}

/**
 * The tokens as the page resolves them right now, for the current theme.
 *
 * Read through a probe's `color` rather than `getPropertyValue('--surface')`,
 * because the latter hands back the alias (`var(--color-neutral-0)`) in some
 * engines and the resolved colour in others; a computed `color` is always a
 * colour.
 */
export function readPalette(root: HTMLElement = document.documentElement): EditorPalette {
  const probe = document.createElement('span');
  probe.style.display = 'none';
  root.appendChild(probe);
  const palette = {} as EditorPalette;
  for (const token of TOKENS) {
    probe.style.color = `var(--${token})`;
    palette[token] = cssColorToHex(getComputedStyle(probe).color) ?? '#808080';
  }
  probe.remove();
  return palette;
}

/** `#rrggbb` with an alpha byte, for Monaco's translucent overlays. */
function withAlpha(colour: string, alpha: number): string {
  return (
    colour.slice(0, 7) +
    Math.round(alpha * 255)
      .toString(16)
      .padStart(2, '0')
  );
}

/** The shape `monaco.editor.defineTheme` takes, without importing Monaco here. */
export interface EditorThemeData {
  base: 'vs' | 'vs-dark';
  inherit: boolean;
  rules: { token: string; foreground?: string; fontStyle?: string }[];
  colors: Record<string, string>;
}

export function editorTheme(theme: 'light' | 'dark', palette: EditorPalette): EditorThemeData {
  const bare = (colour: string) => colour.slice(1, 7);
  return {
    base: theme === 'dark' ? 'vs-dark' : 'vs',
    inherit: true,
    rules: [
      { token: '', foreground: bare(palette.fg) },
      { token: 'keyword', foreground: bare(palette['code-keyword']) },
      { token: 'keyword.flow', foreground: bare(palette['code-keyword']) },
      { token: 'annotation', foreground: bare(palette['code-keyword']) },
      { token: 'comment', foreground: bare(palette['fg-subtle']), fontStyle: 'italic' },
      { token: 'string', foreground: bare(palette['fg-muted']) },
      // Python's tokenizer calls the quote characters `string.escape`; they are part of the string.
      { token: 'string.escape', foreground: bare(palette['fg-muted']) },
      { token: 'number', foreground: bare(palette['fg-muted']) },
      { token: 'number.float', foreground: bare(palette['fg-muted']) },
      { token: 'number.hex', foreground: bare(palette['fg-muted']) },
      { token: 'type', foreground: bare(palette.fg) },
      { token: 'type.identifier', foreground: bare(palette.fg) },
      { token: 'identifier', foreground: bare(palette.fg) },
      { token: 'delimiter', foreground: bare(palette['fg-muted']) },
      { token: 'operator', foreground: bare(palette['fg-muted']) },
    ],
    colors: {
      'editor.background': palette.surface,
      'editor.foreground': palette.fg,
      'editorGutter.background': palette.surface,
      'editorLineNumber.foreground': palette['fg-subtle'],
      'editorLineNumber.activeForeground': palette['fg-muted'],
      // The current line is a step *up* from the card in dark and a step down in
      // light, the same direction every other raised thing takes in its theme.
      'editor.lineHighlightBackground':
        theme === 'dark' ? palette['surface-raised'] : palette['surface-sunken'],
      // A hairline edge, so the cursor's line is found by its outline as well
      // as by a fill that is only a step off the card.
      'editor.lineHighlightBorder': palette.border,
      'editorCursor.foreground': palette.accent,
      // Selection is the app's "selected" step, which holds 1.3:1 on the card;
      // the Callout's paler tint vanished behind selected code.
      'editor.selectionBackground': palette['surface-selected'],
      'editor.inactiveSelectionBackground': withAlpha(palette['surface-selected'], 0.6),
      'editor.selectionHighlightBackground': withAlpha(palette['surface-selected'], 0.5),
      'editor.wordHighlightBackground': withAlpha(palette['surface-selected'], 0.5),
      'editorIndentGuide.background1': palette.border,
      'editorIndentGuide.activeBackground1': palette['border-strong'],
      'editorWhitespace.foreground': palette['border-strong'],
      'editorBracketMatch.background': withAlpha(palette['surface-selected'], 0.6),
      'editorBracketMatch.border': palette['border-strong'],
      'editorError.foreground': palette.danger,
      'editorWarning.foreground': palette.warn,
      'editorWidget.background': palette['surface-raised'],
      'editorWidget.border': palette.border,
      'editorSuggestWidget.background': palette['surface-raised'],
      'editorSuggestWidget.border': palette.border,
      'editorSuggestWidget.selectedBackground': palette['surface-selected'],
      /*
       * Bracket-pair colours. Monaco's own are blue, green, gold and orchid -
       * the accent and two verdict hues on every line of code. One muted
       * colour for all six levels; the match highlight above still pairs them.
       */
      ...Object.fromEntries(
        [1, 2, 3, 4, 5, 6].map((level) => [
          `editorBracketHighlight.foreground${String(level)}`,
          palette['fg-muted'],
        ]),
      ),
      'editorBracketHighlight.unexpectedBracket.foreground': palette.danger,
      'editorHoverWidget.background': palette['surface-raised'],
      'editorHoverWidget.border': palette.border,
      'scrollbarSlider.background': withAlpha(palette['border-strong'], 0.6),
      'scrollbarSlider.hoverBackground': palette['border-strong'],
      'scrollbarSlider.activeBackground': palette['fg-subtle'],
      'editorOverviewRuler.border': palette.surface,
    },
  };
}

/** One theme name per app theme; redefined whenever it is applied. */
export function editorThemeName(theme: 'light' | 'dark'): string {
  return `devpromax-${theme}`;
}
