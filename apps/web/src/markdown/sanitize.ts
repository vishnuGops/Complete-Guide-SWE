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
 * One change to the default schema, and it widens rather than narrows: `id` on
 * headings, so a table of contents or a deep link can point at one. It stays
 * safe because the default `clobber` rule still prefixes every id with
 * `user-content-`, so a heading cannot take over an id the app itself uses.
 *
 * What the default schema already does, and why nothing is added for it:
 *
 *   - `script` is stripped with its contents, and every `on*` handler is
 *     dropped, since no element lists one as allowed.
 *   - `className` is allowed only on the handful of elements GitHub markdown
 *     generates, with fixed values (`code` may carry `language-*`, a task list
 *     its `contains-task-list`). `span` and `div` get none at all, so a
 *     statement cannot paint itself with arbitrary utility classes and escape
 *     the design system.
 *   - KaTeX and the highlighter need nothing extra. What they read on the way
 *     in is a `language-*` class on `code` (`language-math` for remark-math,
 *     `language-python` for a fence), which that rule already keeps; what they
 *     write comes out *after* the sanitiser (see the plugin order in
 *     `Markdown.tsx`), from content that has already been cleaned.
 *
 * `sanitize.test.ts` holds this comment to account by running the schema over
 * a hand-built tree - the rendered component alone cannot, because without
 * `rehype-raw` the HTML in a statement never becomes elements for the
 * sanitiser to see.
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
