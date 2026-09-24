import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Markdown } from './Markdown.js';

/**
 * The statement renderer (ROADMAP P4-3).
 *
 * Two kinds of assertion, and they earn their place differently.
 *
 * The snapshots are over the three pilot statements - the packages that pin the
 * format (P1-3) - because "the statement still renders correctly" is not a
 * property you can state in an assertion; it is a page you have to look at. A
 * snapshot turns the next person's change to the renderer into a diff they have
 * to read rather than a regression nobody notices until a statement is
 * unreadable in the workspace.
 *
 * The rest are properties that must hold whatever the statement says, and the
 * security ones are the reason this component exists rather than a `marked`
 * call at the call site.
 */

const PILOTS = ['arrays/pair-sum-index', 'arrays/shift-right-in-place', 'stack/min-value-stack'];

/** Vitest runs from the repo root (see `vitest.config.ts`). */
function statement(relative: string): string {
  return fs.readFileSync(path.join(process.cwd(), 'problems', relative, 'statement.md'), 'utf8');
}

describe('the pilot statements', () => {
  for (const pilot of PILOTS) {
    it(`renders ${pilot} the same way as it did`, () => {
      const { container } = render(<Markdown content={statement(pilot)} />);
      expect(container.innerHTML).toMatchSnapshot();
    });
  }
});

describe('markdown features a statement relies on', () => {
  it('renders headings, lists and inline code', () => {
    render(
      <Markdown
        content={['## Constraints', '', '- `1 <= n <= 10^5`', '- `nums[i]` is an integer'].join(
          '\n',
        )}
      />,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Constraints' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('1 <= n <= 10^5').tagName).toBe('CODE');
  });

  it('renders GitHub tables, which plain markdown does not', () => {
    render(
      <Markdown
        content={['| Call | Returns |', '| --- | --- |', '| `push(3)` | none |'].join('\n')}
      />,
    );

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Call' })).toBeInTheDocument();
  });

  it('highlights fenced Python and Java', () => {
    const { container } = render(
      <Markdown content={'```python\ndef solve(nums):\n    return nums\n```'} />,
    );

    const code = container.querySelector('pre code');
    expect(code).toHaveClass('hljs');
    expect(code?.querySelector('.hljs-keyword')).toHaveTextContent('def');
  });

  it('leaves a fence in a language the judge does not run as plain text', () => {
    // Auto-detection is off on purpose: a JSON wire-format block guessed as Perl
    // is worse than an unhighlighted one.
    const { container } = render(<Markdown content={'```json\n{"args": [1, 2]}\n```'} />);

    const code = container.querySelector('pre code');
    expect(code).not.toHaveClass('hljs');
    expect(code).toHaveTextContent('{"args": [1, 2]}');
  });
});

describe('sanitisation', () => {
  it('does not render a script tag', () => {
    const { container } = render(
      <Markdown content={'Before\n\n<script>window.stolen = 1;</script>\n\nAfter'} />,
    );

    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('After');
  });

  it('strips a javascript: link but keeps the text', () => {
    render(<Markdown content={'[click me](javascript:alert(1))'} />);

    // The attribute is dropped outright rather than rewritten, so the anchor is
    // inert and the words survive.
    const link = screen.getByText('click me');
    expect(link).not.toHaveAttribute('href');
  });

  it('does not let a statement style itself with arbitrary classes', () => {
    const { container } = render(
      <Markdown content={'<div class="fixed inset-0 bg-danger">covering the app</div>'} />,
    );

    expect(container.querySelector('.fixed')).toBeNull();
  });
});

describe('the link and image overrides (P4-15)', () => {
  it('do not write the hast node onto the DOM', () => {
    const { container } = render(
      <Markdown content={'[a link](https://example.com)\n\n![a grid](grid.png)'} />,
    );

    // react-markdown passes `node` to custom components; spread onto the
    // element it became `node="[object Object]"`.
    expect(container.querySelector('a')).not.toHaveAttribute('node');
    expect(container.querySelector('img')).not.toHaveAttribute('node');
  });
});

describe('images', () => {
  it('resolves a relative image against the problem assets route', () => {
    render(<Markdown content={'![a grid](grid.png)'} assetSlug="min-value-stack" />);

    expect(screen.getByRole('img', { name: 'a grid' })).toHaveAttribute(
      'src',
      '/api/problems/min-value-stack/assets/grid.png',
    );
  });

  it('leaves an absolute image alone', () => {
    render(
      <Markdown content={'![remote](https://example.com/x.png)'} assetSlug="min-value-stack" />,
    );

    expect(screen.getByRole('img', { name: 'remote' })).toHaveAttribute(
      'src',
      'https://example.com/x.png',
    );
  });
});

/**
 * Images in a model's answer (ROADMAP P5-10).
 *
 * `rehype-sanitize` allows any `img src`, and coach markdown is influenced by
 * the code in the editor and by the problem text - so an injected image URL is
 * a beacon that fires the moment the answer paints, with no click involved.
 */
describe('coach content', () => {
  it('drops an image that points anywhere but this app', () => {
    const { container } = render(
      <Markdown content="![beacon](https://elsewhere.example/x.png?c=1)" trust="coach" />,
    );

    // Queried through the container rather than by role: an `img` with no `src`
    // has no accessible image role to find it by, which is rather the point.
    const image = container.querySelector('img');
    expect(image).not.toBeNull();
    expect(image?.getAttribute('src') ?? '').not.toContain('elsewhere.example');
  });

  it('keeps an image served by the assets route', () => {
    render(
      <Markdown content="![grid](/api/problems/pair-sum-index/assets/grid.png)" trust="coach" />,
    );

    expect(screen.getByRole('img', { name: 'grid' })).toHaveAttribute(
      'src',
      '/api/problems/pair-sum-index/assets/grid.png',
    );
  });

  it('leaves a link alone, because following one is the user’s choice', () => {
    render(<Markdown content="[the docs](https://example.com/spec)" trust="coach" />);

    expect(screen.getByRole('link', { name: 'the docs' })).toHaveAttribute(
      'href',
      'https://example.com/spec',
    );
  });

  it('still embeds a statement’s own images, which we wrote', () => {
    render(<Markdown content="![grid](grid.png)" assetSlug="pair-sum-index" />);

    expect(screen.getByRole('img', { name: 'grid' })).toHaveAttribute(
      'src',
      '/api/problems/pair-sum-index/assets/grid.png',
    );
  });
});
