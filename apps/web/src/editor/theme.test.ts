import { describe, expect, it } from 'vitest';
import { cssColorToHex, editorTheme, type EditorPalette } from './theme.js';

/**
 * The editor's theme (ROADMAP P9-6).
 *
 * Monaco takes hex and the page computes OKLCH, so the conversion is the part
 * that can be quietly wrong: a colour one step off would put the editor on a
 * slightly different white from the card around it, which is exactly the
 * "pasted in" look the theme exists to remove.
 */

describe('cssColorToHex', () => {
  it('converts the OKLCH the page computes', () => {
    expect(cssColorToHex('oklch(1 0 0)')).toBe('#ffffff');
    expect(cssColorToHex('oklch(0 0 0)')).toBe('#000000');
    // sRGB blue is oklch(0.452 0.313 264.05); the round trip lands on it.
    expect(cssColorToHex('oklch(0.452 0.313 264.05)')).toBe('#0000ff');
  });

  it('keeps an alpha channel', () => {
    expect(cssColorToHex('oklch(1 0 0 / 0.5)')).toBe('#ffffff80');
    expect(cssColorToHex('rgba(255, 0, 0, 0.25)')).toBe('#ff000040');
  });

  it('reads rgb() and percentage lightness', () => {
    expect(cssColorToHex('rgb(18, 52, 86)')).toBe('#123456');
    expect(cssColorToHex('oklch(100% 0 0)')).toBe('#ffffff');
  });

  it('says so rather than guessing at something it does not understand', () => {
    expect(cssColorToHex('color-mix(in oklch, red, blue)')).toBeUndefined();
  });
});

describe('editorTheme', () => {
  const palette: EditorPalette = {
    surface: '#ffffff',
    'surface-sunken': '#f7f8fa',
    'surface-selected': '#dfe7fb',
    'surface-raised': '#ffffff',
    fg: '#15171c',
    'fg-muted': '#4a4f5a',
    'fg-subtle': '#5f6570',
    border: '#e4e6ea',
    'border-strong': '#cfd2d8',
    accent: '#2f5bea',
    'accent-subtle': '#eef2fd',
    'code-keyword': '#7a3fc0',
    danger: '#d0343b',
    warn: '#8a5a10',
  };

  it('sits on the card: the editor background is the surface token', () => {
    expect(editorTheme('light', palette).colors['editor.background']).toBe('#ffffff');
  });

  it('keeps keywords off the accent', () => {
    const keyword = editorTheme('dark', palette).rules.find((rule) => rule.token === 'keyword');
    expect(keyword?.foreground).toBe('7a3fc0');
    expect(keyword?.foreground).not.toBe(palette.accent.slice(1));
  });

  it('paints no string or number in a verdict colour', () => {
    const { rules } = editorTheme('light', palette);
    for (const token of ['string', 'number']) {
      expect(rules.find((rule) => rule.token === token)?.foreground).toBe('4a4f5a');
    }
  });

  it('builds on the matching stock theme for anything it does not name', () => {
    expect(editorTheme('dark', palette).base).toBe('vs-dark');
    expect(editorTheme('light', palette).base).toBe('vs');
  });
});
