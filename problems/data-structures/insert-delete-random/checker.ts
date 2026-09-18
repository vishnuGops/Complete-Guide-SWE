import type { CheckerFn } from '@devpromax/shared';

/**
 * `pick` may return any member, so the returns cannot be compared directly.
 *
 * The checker replays the operation sequence, keeping the set itself, and
 * checks each return against what that operation must have produced: `add` and
 * `remove` have one right answer each, and `pick` has one right *property* -
 * the value has to be in the set at that moment (ROADMAP D6).
 */
const check: CheckerFn = ({ input, actual }) => {
  if (!Array.isArray(actual)) {
    return { pass: false, message: `expected a list of returns, got ${JSON.stringify(actual)}` };
  }

  const ops = input.ops ?? [];
  if (actual.length !== ops.length) {
    return {
      pass: false,
      message: `expected ${ops.length} return(s), got ${actual.length}`,
    };
  }

  const present = new Set<number>();

  for (let at = 0; at < ops.length; at += 1) {
    const op = ops[at];
    if (op === undefined) continue;
    const got = actual[at];

    if (op.method === 'add') {
      const value = Number(op.args?.[0]);
      const expected = !present.has(value);
      if (got !== expected) {
        return {
          pass: false,
          message: `call ${at}, add(${value}): expected ${String(expected)}, got ${JSON.stringify(got)}`,
        };
      }
      present.add(value);
    } else if (op.method === 'remove') {
      const value = Number(op.args?.[0]);
      const expected = present.has(value);
      if (got !== expected) {
        return {
          pass: false,
          message: `call ${at}, remove(${value}): expected ${String(expected)}, got ${JSON.stringify(got)}`,
        };
      }
      present.delete(value);
    } else if (op.method === 'pick') {
      if (typeof got !== 'number' || !present.has(got)) {
        return {
          pass: false,
          message:
            `call ${at}, pick(): ${JSON.stringify(got)} is not in the set, which holds ` +
            `${present.size} value(s)`,
        };
      }
    } else {
      return { pass: false, message: `unknown operation "${String(op.method)}" at call ${at}` };
    }
  }

  return { pass: true };
};

export default check;
