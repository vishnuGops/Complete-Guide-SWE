import { describe, it, expect } from 'vitest';
import { SHARED_PLACEHOLDER } from './index.js';

describe('scaffold', () => {
  it('resolves the shared workspace', () => {
    expect(SHARED_PLACEHOLDER).toBeTypeOf('string');
  });
});
