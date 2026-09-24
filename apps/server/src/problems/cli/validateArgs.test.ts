import { describe, expect, it } from 'vitest';
import { parseValidateArgs } from './validateArgs.js';

describe('problems:validate arguments', () => {
  it('takes a lone slug as the one problem to validate', () => {
    // The bug: this validated all 171 problems, because the slug at index 0 was
    // mistaken for the ref after a `--changed` that was not there.
    expect(parseValidateArgs(['two-colour-graph'], {})).toEqual({
      staticOnly: false,
      slug: 'two-colour-graph',
    });
  });

  it('does not take the ref after --changed for a slug', () => {
    expect(parseValidateArgs(['--changed', 'origin/main'], {})).toEqual({
      staticOnly: false,
      changedFrom: 'origin/main',
    });
    expect(parseValidateArgs(['--changed', 'origin/main', 'mirror-tree'], {})).toEqual({
      staticOnly: false,
      changedFrom: 'origin/main',
      slug: 'mirror-tree',
    });
  });

  it('reads the flags npm swallows into its own config', () => {
    expect(
      parseValidateArgs(['mirror-tree'], { npm_config_static: 'true', npm_config_changed: 'HEAD' }),
    ).toEqual({ staticOnly: true, slug: 'mirror-tree', changedFrom: 'HEAD' });
  });

  it('validates everything when given nothing', () => {
    expect(parseValidateArgs([], {})).toEqual({ staticOnly: false });
  });
});
