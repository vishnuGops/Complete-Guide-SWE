/**
 * Reading one string field out of JSON that has not finished arriving (P5-1).
 *
 * The coach returns structured JSON (D13), but the panel is supposed to show
 * prose as it is written rather than a spinner followed by a wall of text. Those
 * two things are in tension: the markdown the user should watch being typed is
 * the value of `feedbackMarkdown`, and it is a string *inside* the JSON object,
 * so nothing can be rendered until enough of the object has arrived to find it.
 *
 * The usual answers are both bad here. Two requests (one for prose, one for
 * scores) doubles the cost of every AI Help click and lets the two disagree. A
 * full incremental JSON parser is a lot of machinery for one field.
 *
 * So this reads exactly one top-level string field out of a partial document and
 * gives back however much of it has arrived, decoded. It is deliberately not a
 * JSON parser: it does not validate the document, and the final value is still
 * `JSON.parse`d and checked against the zod schema once the stream ends. This is
 * only for what to paint while waiting.
 */

/** The escapes JSON defines. Anything else after a backslash is not our problem. */
const SIMPLE_ESCAPES: Record<string, string> = {
  '"': '"',
  '\\': '\\',
  '/': '/',
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
};

/**
 * Finds `"<field>"` used as a key - that is, followed by a colon - and returns
 * the index just past the opening quote of its string value.
 *
 * Scanning for the key means walking the document as a string so that a `"foo"`
 * appearing *inside* an earlier value is not mistaken for the key `foo`. The walk
 * tracks whether it is inside a string and whether the previous character was an
 * escape, which is the whole of what it takes to not be fooled.
 */
function findValueStart(raw: string, field: string): number | null {
  const key = `"${field}"`;
  let i = 0;
  let inString = false;
  let escaped = false;

  while (i < raw.length) {
    const ch = raw[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      i += 1;
      continue;
    }

    if (ch === '"') {
      // A string starts here. If it is our key, the next non-space character
      // must be a colon, and the one after that the opening quote of the value.
      if (raw.startsWith(key, i)) {
        let j = i + key.length;
        while (j < raw.length && /\s/.test(raw[j]!)) j += 1;
        if (raw[j] === ':') {
          j += 1;
          while (j < raw.length && /\s/.test(raw[j]!)) j += 1;
          if (raw[j] === '"') return j + 1;
          // The value is not a string, or has not arrived yet. Either way this
          // key is not going to give us text, so stop rather than keep looking:
          // a second `"field"` deeper in the document is a different field.
          return null;
        }
      }
      inString = true;
      i += 1;
      continue;
    }

    i += 1;
  }

  return null;
}

export interface PartialString {
  /** What has arrived so far, with escapes decoded. */
  value: string;
  /** True once the closing quote has been seen, so the value will not grow. */
  complete: boolean;
}

/**
 * Decodes from `start` until the closing quote or the end of the input.
 *
 * A chunk boundary can land anywhere, including the middle of `\uD83D`. An
 * incomplete escape at the tail is dropped rather than guessed at: it will be
 * complete on the next chunk, and emitting a lone backslash would put a
 * character on screen that is not in the text.
 */
function decodeFrom(raw: string, start: number): PartialString {
  let out = '';
  let i = start;

  while (i < raw.length) {
    const ch = raw[i]!;

    if (ch === '"') return { value: out, complete: true };

    if (ch !== '\\') {
      out += ch;
      i += 1;
      continue;
    }

    const next = raw[i + 1];
    if (next === undefined) break; // trailing backslash: wait for more

    if (next === 'u') {
      const hex = raw.slice(i + 2, i + 6);
      if (hex.length < 4) break; // half an escape: wait for more
      const code = Number.parseInt(hex, 16);
      if (Number.isNaN(code)) {
        // Malformed. The final parse will reject the document; until then,
        // showing the raw characters beats throwing away the rest of the text.
        out += raw.slice(i, i + 6);
      } else {
        out += String.fromCharCode(code);
      }
      i += 6;
      continue;
    }

    const simple = SIMPLE_ESCAPES[next];
    out += simple ?? next;
    i += 2;
  }

  return { value: out, complete: false };
}

/**
 * How much of `field` has arrived, decoded.
 *
 * Returns null when the key has not been seen yet, which is different from
 * having seen it with an empty value.
 */
export function readPartialString(raw: string, field: string): PartialString | null {
  const start = findValueStart(raw, field);
  if (start === null) return null;
  return decodeFrom(raw, start);
}

/**
 * Turns a growing buffer into deltas.
 *
 * The caller accumulates raw text and asks after each chunk what is new. Keeping
 * the "already emitted" mark here rather than in the provider is what lets both
 * vendors share one implementation: Anthropic and Gemini differ in how bytes
 * arrive, not in what the JSON means.
 *
 * Re-scanning the whole buffer per chunk is quadratic in principle. In practice
 * the document is a few kilobytes of feedback and the scan is a character loop,
 * so the cost is invisible next to the network round trip that produced the
 * chunk. If that ever stops being true, the fix is to remember the scan
 * position, not to change this interface.
 */
export function createStringStreamer(field: string) {
  let emitted = 0;

  return {
    /** The newly-arrived part of the field, or `''` when nothing has grown. */
    push(raw: string): string {
      const partial = readPartialString(raw, field);
      if (partial === null) return '';
      if (partial.value.length <= emitted) return '';
      const delta = partial.value.slice(emitted);
      emitted = partial.value.length;
      return delta;
    },
  };
}
