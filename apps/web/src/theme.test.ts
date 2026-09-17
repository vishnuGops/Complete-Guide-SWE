import { afterEach, describe, expect, it } from 'vitest';
import { applyTheme, resolvedTheme } from './theme.js';

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

describe('applyTheme', () => {
  it('writes the chosen theme onto the document', () => {
    applyTheme('dark');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');

    applyTheme('light');
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });

  it('removes the attribute for system, rather than freezing a resolved value', () => {
    // The attribute is what overrides the media query, so writing "dark" for a
    // system choice would stop the page following the OS if it changed.
    applyTheme('dark');
    applyTheme('system');
    expect(document.documentElement).not.toHaveAttribute('data-theme');
  });
});

describe('resolvedTheme', () => {
  it('passes an explicit choice straight through', () => {
    expect(resolvedTheme('dark')).toBe('dark');
    expect(resolvedTheme('light')).toBe('light');
  });

  it('asks the OS what system means', () => {
    // jsdom reports no preference, which is the light branch.
    expect(resolvedTheme('system')).toBe('light');
  });
});
