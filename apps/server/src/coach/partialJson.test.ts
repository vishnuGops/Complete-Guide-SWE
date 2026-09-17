import { describe, expect, it } from 'vitest';
import { createStringStreamer, readPartialString } from './partialJson.js';

/**
 * The partial-string reader (ROADMAP P5-1).
 *
 * What these tests are really defending is the chunk boundary. A stream splits
 * wherever the network decides, so every case below is "the document stops
 * here" - mid-value, mid-escape, halfway through a `\u` sequence - and the
 * question is always the same: does the reader show only text that is really
 * there, and does it catch up once the rest arrives?
 */

describe('readPartialString', () => {
  it('returns null until the key has been seen', () => {
    expect(readPartialString('{"sum', 'feedbackMarkdown')).toBeNull();
    expect(readPartialString('{"summary": "hi"}', 'feedbackMarkdown')).toBeNull();
  });

  it('reads a value that has not finished arriving', () => {
    expect(readPartialString('{"feedbackMarkdown": "Your loop', 'feedbackMarkdown')).toEqual({
      value: 'Your loop',
      complete: false,
    });
  });

  it('marks the value complete at the closing quote', () => {
    expect(readPartialString('{"feedbackMarkdown": "done"}', 'feedbackMarkdown')).toEqual({
      value: 'done',
      complete: true,
    });
  });

  it('distinguishes an empty value from an absent one', () => {
    expect(readPartialString('{"feedbackMarkdown": ""}', 'feedbackMarkdown')).toEqual({
      value: '',
      complete: true,
    });
  });

  it('decodes the escapes that markdown actually contains', () => {
    const raw = String.raw`{"feedbackMarkdown": "line\none\ttab \"quoted\" back\\slash"}`;
    expect(readPartialString(raw, 'feedbackMarkdown')?.value).toBe(
      'line\none\ttab "quoted" back\\slash',
    );
  });

  it('holds back a trailing backslash rather than showing it', () => {
    // The next chunk decides whether this is a newline or a literal backslash.
    expect(readPartialString('{"feedbackMarkdown": "end\\', 'feedbackMarkdown')).toEqual({
      value: 'end',
      complete: false,
    });
  });

  it('holds back a half-arrived unicode escape', () => {
    expect(readPartialString('{"feedbackMarkdown": "n\\u00', 'feedbackMarkdown')?.value).toBe('n');
    expect(readPartialString('{"feedbackMarkdown": "n\\u00e9', 'feedbackMarkdown')?.value).toBe(
      'né',
    );
  });

  it('is not fooled by the key name appearing inside an earlier value', () => {
    const raw = '{"summary": "about feedbackMarkdown", "feedbackMarkdown": "real"}';
    expect(readPartialString(raw, 'feedbackMarkdown')?.value).toBe('real');
  });

  it('is not fooled by an escaped quote ending an earlier value', () => {
    const raw = String.raw`{"summary": "he said \"feedbackMarkdown\"", "feedbackMarkdown": "real"}`;
    expect(readPartialString(raw, 'feedbackMarkdown')?.value).toBe('real');
  });

  it('gives up on a non-string value rather than reading past it', () => {
    expect(readPartialString('{"feedbackMarkdown": 12}', 'feedbackMarkdown')).toBeNull();
  });
});

describe('createStringStreamer', () => {
  it('emits each chunk once and nothing twice', () => {
    const streamer = createStringStreamer('feedbackMarkdown');
    let raw = '';
    const seen: string[] = [];

    for (const chunk of ['{"feedbackMarkdown": "Your ', 'loop is ', 'O(n^2)."}']) {
      raw += chunk;
      seen.push(streamer.push(raw));
    }

    expect(seen).toEqual(['Your ', 'loop is ', 'O(n^2).']);
    expect(seen.join('')).toBe('Your loop is O(n^2).');
  });

  it('stays silent while the preamble arrives', () => {
    const streamer = createStringStreamer('feedbackMarkdown');
    expect(streamer.push('{"summary": "ok", "scores": {')).toBe('');
    expect(streamer.push('{"summary": "ok", "scores": {}, "feedbackMarkdown": "go')).toBe('go');
  });

  it('does not re-emit text when a chunk adds nothing to the field', () => {
    const streamer = createStringStreamer('feedbackMarkdown');
    const raw = '{"feedbackMarkdown": "all of it"';
    expect(streamer.push(raw)).toBe('all of it');
    // Trailing fields grow the document but not this value.
    expect(streamer.push(`${raw}, "mastered": false}`)).toBe('');
  });

  it('releases a held-back escape on the chunk that completes it', () => {
    const streamer = createStringStreamer('feedbackMarkdown');
    expect(streamer.push('{"feedbackMarkdown": "a\\')).toBe('a');
    expect(streamer.push('{"feedbackMarkdown": "a\\n')).toBe('\n');
  });
});
