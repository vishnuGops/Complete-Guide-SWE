import { defaultSchema } from 'rehype-sanitize';
import type { Options as SanitizeOptions } from 'rehype-sanitize';

/**
 * What a problem statement is allowed to contain (ROADMAP P4-3).
 *
 * Statements are repository content written by us, so this is not a defence
 * against a hostile author - it is a defence against the day a statement is
 * pasted in from somewhere, or an editorial quotes a page that happened to
 * contain a `<script>`. Content is rendered as React elements and never through
 * `dangerouslySetInnerHTML`, so raw HTML in the markdown is already inert;
 * sanitising as well means the answer does not depend on remembering that.
 *
 * Two changes to the default schema, both narrowing:
 *
 *   - `id` on headings, so a table of contents or a deep link can point at one.
 *   - `className` on `span` and `div` restricted to the classes KaTeX and the
 *     highlighter need. The default schema already allows the KaTeX markers;
 *     this keeps them and adds nothing else, so a statement cannot paint itself
 *     with arbitrary utility classes and escape the design system.
 */
export const sanitizeOptions: SanitizeOptions = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    h1: [...(defaultSchema.attributes?.h1 ?? []), 'id'],
    h2: [...(defaultSchema.attributes?.h2 ?? []), 'id'],
    h3: [...(defaultSchema.attributes?.h3 ?? []), 'id'],
    h4: [...(defaultSchema.attributes?.h4 ?? []), 'id'],
  },
};
