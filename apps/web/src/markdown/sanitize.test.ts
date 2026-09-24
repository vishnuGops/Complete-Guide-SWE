import { describe, expect, it } from 'vitest';
import type { Element, ElementContent, Root } from 'hast';
import rehypeSanitize from 'rehype-sanitize';
import { sanitizeOptions } from './sanitize.js';

/**
 * The sanitiser's schema, on its own (ROADMAP P4-15).
 *
 * `Markdown.test.tsx` renders markdown, and without `rehype-raw` the HTML in it
 * never becomes elements - so its "script is not rendered" assertions pass
 * whatever this schema says. These build the hostile tree by hand and run the
 * schema over it, which is the only way to test the second lock rather than
 * the first.
 */

function el(
  tagName: string,
  properties: Element['properties'] = {},
  children: ElementContent[] = [],
): Element {
  return { type: 'element', tagName, properties, children };
}

function text(value: string): ElementContent {
  return { type: 'text', value };
}

function clean(...children: ElementContent[]): Root {
  return rehypeSanitize(sanitizeOptions)({ type: 'root', children });
}

/** Every element in the tree, depth first. */
function elements(node: Root | Element): Element[] {
  return node.children.flatMap((child) =>
    child.type === 'element' ? [child, ...elements(child)] : [],
  );
}

describe('the sanitiser schema', () => {
  it('strips a script element together with what is inside it', () => {
    const tree = clean(el('p', {}, [text('Before')]), el('script', {}, [text('window.x = 1')]));

    expect(elements(tree).map((node) => node.tagName)).toEqual(['p']);
    expect(JSON.stringify(tree)).not.toContain('window.x');
  });

  it('drops every on* handler', () => {
    const tree = clean(
      el('a', { href: 'https://example.com', onClick: 'steal()', onMouseOver: 'steal()' }, [
        text('link'),
      ]),
      el('img', { src: 'x.png', alt: '', onError: 'steal()' }),
    );

    for (const node of elements(tree)) {
      expect(Object.keys(node.properties).filter((key) => /^on/i.test(key))).toEqual([]);
    }
    // The element itself survives; only the handler goes.
    expect(elements(tree).map((node) => node.tagName)).toEqual(['a', 'img']);
  });

  it('gives span and div no classes at all', () => {
    const tree = clean(
      el('div', { className: ['fixed', 'inset-0', 'bg-danger'] }, [
        el('span', { className: ['math-inline', 'text-accent'] }, [text('x')]),
      ]),
    );

    for (const node of elements(tree)) expect(node.properties['className']).toBeUndefined();
  });

  it('keeps a language class on code, which the highlighter and KaTeX read', () => {
    const tree = clean(
      el('pre', {}, [el('code', { className: ['language-python', 'arbitrary'] }, [text('x')])]),
    );

    const code = elements(tree).find((node) => node.tagName === 'code');
    expect(code?.properties['className']).toEqual(['language-python']);
  });

  it('keeps ids on headings, under the clobber prefix', () => {
    const tree = clean(el('h2', { id: 'constraints' }, [text('Constraints')]));

    expect(elements(tree)[0]?.properties['id']).toBe('user-content-constraints');
  });
});
