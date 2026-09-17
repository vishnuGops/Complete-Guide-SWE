import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/**
 * jsdom has no ResizeObserver, and Radix's floating primitives (tooltips,
 * menus, dialogs) measure their trigger on mount. Without this, every component
 * test that renders one fails on a browser API rather than on anything about
 * the component.
 *
 * It reports nothing, which is correct: jsdom has no layout, so there is no
 * size to report and nothing in our tests asserts on placement.
 */
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
}

afterEach(() => {
  cleanup();
});
