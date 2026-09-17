import type { Element, ElementContent, Root } from 'hast';
import { createLowlight } from 'lowlight';
import java from 'highlight.js/lib/languages/java';
import python from 'highlight.js/lib/languages/python';
import { visit } from 'unist-util-visit';

/**
 * Syntax highlighting for fenced code, in the two languages this app runs
 * (ROADMAP P4-3).
 *
 * `rehype-highlight` would do this in one line, and it imports highlight.js's
 * `common` bundle - about forty grammars - to do it. That is the same mistake
 * the Monaco setup already refuses (see `editor/monaco.ts`): an offline-first
 * tool that ships a Ruby tokenizer it will never run. Registering `python` and
 * `java` against `lowlight` directly is a dozen lines and costs two grammars.
 *
 * Unknown or absent languages are left alone rather than auto-detected. Fenced
 * blocks in a statement are often wire-format JSON or shell output, and
 * highlight.js guessing "this is Perl" is worse than plain text.
 */

const lowlight = createLowlight({ java, python });

/** What an author might write after the fence, mapped to what lowlight knows. */
const ALIASES: Record<string, string> = {
  java: 'java',
  python: 'python',
  py: 'python',
  python3: 'python',
};

function languageOf(node: Element): string | undefined {
  const classes = node.properties.className;
  const list = Array.isArray(classes) ? classes : [];
  for (const entry of list) {
    if (typeof entry !== 'string' || !entry.startsWith('language-')) continue;
    const named = ALIASES[entry.slice('language-'.length).toLowerCase()];
    if (named) return named;
  }
  return undefined;
}

function textOf(node: Element): string {
  return node.children.map((child) => (child.type === 'text' ? child.value : '')).join('');
}

export function rehypeHighlight() {
  return (tree: Root): void => {
    visit(tree, 'element', (node: Element, _index, parent) => {
      if (node.tagName !== 'code') return;
      if (!parent || parent.type !== 'element' || parent.tagName !== 'pre') return;

      const language = languageOf(node);
      if (!language) return;

      // Generated from text that has already been through the sanitiser, so the
      // spans below carry no attacker-controlled attributes - only the class
      // names lowlight assigns.
      //
      // The filter narrows lowlight's `Root` children to what may live inside an
      // element. Nothing it emits is a doctype; the narrowing is how that is
      // stated rather than asserted.
      node.children = lowlight
        .highlight(language, textOf(node))
        .children.filter(
          (child): child is ElementContent =>
            child.type === 'element' || child.type === 'text' || child.type === 'comment',
        );
      node.properties.className = [`language-${language}`, 'hljs'];
    });
  };
}
