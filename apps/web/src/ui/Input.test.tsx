import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from './Input.js';

describe('Input', () => {
  it('is reachable by its label', async () => {
    const user = userEvent.setup();
    render(
      <>
        <label htmlFor="search">Search</label>
        <Input id="search" />
      </>,
    );

    await user.type(screen.getByLabelText('Search'), 'two pointers');
    expect(screen.getByLabelText('Search')).toHaveValue('two pointers');
  });

  it('announces invalid state rather than only colouring the border', () => {
    const { rerender } = render(<Input aria-label="Slug" />);
    expect(screen.getByLabelText('Slug')).not.toHaveAttribute('aria-invalid');

    rerender(<Input aria-label="Slug" invalid />);
    expect(screen.getByLabelText('Slug')).toHaveAttribute('aria-invalid', 'true');
  });

  it('can be described by its own error message', () => {
    render(
      <>
        <Input aria-label="Slug" invalid aria-describedby="slug-error" />
        <p id="slug-error">Lowercase letters only.</p>
      </>,
    );

    expect(screen.getByLabelText('Slug')).toHaveAccessibleDescription('Lowercase letters only.');
  });

  it('refuses input when disabled', async () => {
    const user = userEvent.setup();
    render(<Input aria-label="Slug" disabled />);

    await user.type(screen.getByLabelText('Slug'), 'nope');
    expect(screen.getByLabelText('Slug')).toHaveValue('');
  });

  it('switches to the mono face for values read character by character', () => {
    render(<Input aria-label="Key" mono />);
    expect(screen.getByLabelText('Key').className).toContain('font-mono');
  });
});
