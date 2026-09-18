import type { CheckerFn } from '@devpromax/shared';

/**
 * Any arrangement with no two neighbouring letters equal is accepted.
 *
 * The reference's own answer is one of several, so `expected` is used only for
 * the one thing that *is* unique: whether an arrangement exists at all. The
 * empty string means it does not (ROADMAP D6).
 */
const check: CheckerFn = ({ input, expected, actual }) => {
  if (typeof actual !== 'string') {
    return { pass: false, message: `expected a string, got ${JSON.stringify(actual)}` };
  }

  const letters = input.args?.[0];
  if (typeof letters !== 'string') {
    return { pass: false, message: 'the test input is not a string' };
  }

  const impossible = expected === '';
  if (impossible) {
    return actual === ''
      ? { pass: true }
      : {
          pass: false,
          message:
            'no arrangement of these letters can avoid a repeat, so the answer is the empty string',
        };
  }

  if (actual === '') {
    return {
      pass: false,
      message: `an arrangement exists (for example "${String(expected)}"), so the empty string is wrong`,
    };
  }

  if (actual.length !== letters.length) {
    return {
      pass: false,
      message: `the answer has ${actual.length} letter(s) but the word has ${letters.length}`,
    };
  }

  const counts = new Map<string, number>();
  for (const letter of letters) counts.set(letter, (counts.get(letter) ?? 0) + 1);
  for (const letter of actual) {
    const left = counts.get(letter);
    if (left === undefined || left === 0) {
      return { pass: false, message: `the answer uses "${letter}" more often than the word does` };
    }
    counts.set(letter, left - 1);
  }

  for (let at = 1; at < actual.length; at += 1) {
    if (actual[at] === actual[at - 1]) {
      return {
        pass: false,
        message: `"${actual[at]}" appears twice in a row at position ${at - 1}`,
      };
    }
  }

  return { pass: true };
};

export default check;
