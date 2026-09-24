# Authoring problems

How a problem gets written, and what it has to satisfy before it can merge
(ROADMAP P2-9, D7, D9). The on-disk format is specified in
[PROBLEM_FORMAT.md](PROBLEM_FORMAT.md); this is the working process.

---

## 1. The loop

```
npm run problems:new <topic> <slug> -- [--mode operations] [--expect mutatedArgs] [--tier Medium]
  ... write the statement, the samples, both references, the generator ...
npm run problems:gen <slug>          # hidden tests, computed by the reference
npm run problems:validate <slug>     # the merge gate
```

`problems:new` writes a package full of `TODO` markers. The validator treats a
surviving `TODO` as an error, so a scaffold cannot be finished by accident — the
list it prints on creation is the real remaining work.

`problems:gen` runs `generator.py`, hands the inputs to the **Python reference**
to compute the answers, then runs the **Java reference** against those answers
through the problem's own comparator. If the two references disagree, it refuses
to write and tells you which case. It bumps `meta.version` only when the tests
actually changed.

`problems:validate` runs both references against every test in both languages and
checks the starters compile. This runs in CI as the Problem contract step of the `test` job; a
problem that is not solvable as specified cannot merge.

---

## 2. Choosing the problem

**Original wording, always.** Never paste or paraphrase a LeetCode statement.
The pattern being taught is not ownable — two pointers is two pointers — but the
scenario, the phrasing, the examples and the constraints must be ours. Write the
statement from the pattern, not from another site's page.

A problem earns its place if it:

- teaches one pattern clearly, and that pattern is in the topic's plan;
- has a solution a competent person reaches in interview time;
- has edge cases that are interesting rather than merely fiddly;
- is checkable — a single right answer, or an answer a comparator can accept.

Pick the **mode** before writing anything:

| Mode                       | Use when                                        | Entry                |
| -------------------------- | ----------------------------------------------- | -------------------- |
| `function` / `return`      | The answer is a value.                          | Method on `Solution` |
| `function` / `mutatedArgs` | The work is done in place.                      | Method on `Solution` |
| `function` / `both`        | In place _and_ a value (a new length, say).     | Method on `Solution` |
| `operations`               | A data structure driven by a sequence of calls. | The class itself     |

And the **comparator**: `exact` unless the answer genuinely has no order
(`unorderedList`, `unorderedListOfLists`), is floating point (`floatTolerance`
with an explicit `eps`), or admits several correct answers (`checker`, with a
`checker.ts` that says _why_ an answer is wrong, not just that it is).

---

## 3. The statement

Required sections, enforced by the validator: `## Input`, `## Output`,
`## Constraints`, `## Examples`, and one `### Example N` per sample, in order.

- **Say the shape of the input concretely.** "an array of integers" and
  "`nums` — a list of integers, possibly empty" are not the same promise.
- **Say what happens at the edges.** Empty input, a single element, no answer at
  all, ties. If the statement is silent, the tests are the specification, which
  means the user finds out by failing.
- **Constraints are a contract with the generator.** Every bound you write is a
  bound `generator.py` must respect, and every guarantee ("exactly one valid
  pair") is one it must produce. Write the constraints first and generate to
  them, rather than writing constraints to match what you happened to generate.
- **Three samples minimum**, each earning its place: a plain case, an edge, and
  one that would catch a plausible wrong approach. Every sample needs an
  explanation — it is shown in the statement, so it explains rather than repeats —
  and a `name`, which the results panel labels it with.
- **Invent the example inputs.** A classic problem's well-known example —
  `[2, 7, 11, 15]`, `"horse"` and `"ros"`, `[3, 9, 20, null, null, 15, 7]` — is
  part of someone else's statement even when the wording around it is ours. The
  P6-8 audit replaced about forty of them; the only inputs worth keeping are the
  ones with no alternative, such as the empty list.
- **An untouched starter should fail.** Pick samples, or the Java starter's
  placeholder, so the placeholder passes at most one sample. A first Run that
  shows two green samples for `return false;` teaches the wrong thing.
- Target complexity goes in `meta.targetComplexity`; the coach quotes it as the
  bar to meet, so `O(n)` there means an `O(n²)` accepted solution is not done.

## 4. The hints ladder

Four rungs in `hints.json`, and they must actually be a ladder:

1. **Nudge** — what to notice about the input.
2. **Concept** — the data structure or invariant.
3. **Approach** — the method, still without code.
4. **Shape** — the loop or recursion, close to pseudocode.

Rung 4 must not be the solution. A user who reads all four should still have to
write it. The validator enforces the shape of that rule rather than its spirit:
**no rung may contain code** — no fenced block, no `lambda`, no `map.get(...)`,
no `values[i] = ...`, no trailing semicolon. If a rung needs an expression to
make sense, it is describing the answer rather than pointing at it.

Half the seed catalogue failed this on rung 4, one of them with the reference's
own line (ROADMAP P6-0), which is what turned it into a validator rule.

And a constraint you state is a constraint you test (**D21**): the largest
hidden input must reach at least half of any size bound the statement claims, or
the validator warns. A problem whose editorial says the quadratic approach times
out has to have a test where it does.

## 5. Both references

Both must be idiomatic in their language, not a transliteration of each other.
Python uses comprehensions, `dict`, tuple unpacking; Java uses `HashMap`, arrays,
`StringBuilder`. A reference that reads like translated Python teaches the wrong
lesson to whoever opens the editorial.

Rules the validator enforces:

- `function` mode: a `class Solution` with the entry method, in both languages.
- `operations` mode: a class named exactly `meta.entry`, in both languages.
- Java classes are **package-private** — never `public class` — because the code
  is always saved as `Solution.java`.
- Never define `ListNode`, `TreeNode` or any `DevProMax*` class; the harness owns
  them. The full rules are `docs/PROBLEM_FORMAT.md` §9.

The **starter** is the reference with the body removed. It must compile and
import — someone's first Run should fail on their logic, not on our scaffold.

## 6. The generator

`generator.py` defines `generate(rng)` and yields **inputs only**:

```python
def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield {"args": [[4, 9], 13], "name": "smallest possible input"}
    ...
    yield {"args": [values, target]}
```

- Use the `rng` you are handed and nothing else. It is seeded from the slug, so
  a regeneration with no changes produces a byte-identical `tests.json` and a
  diff only ever shows real change. Iterating a `set` or `dict` of strings is
  safe: generators run with `PYTHONHASHSEED=0`, so that order is fixed too
  (P2-16). Anything else from outside the `rng` - the clock, `os.urandom`, the
  global `random` module - breaks `problems:gen --check`.
- **Never yield `expected`.** The reference is the oracle; a generator that
  asserted an answer would be a second source of truth, and the two would
  eventually disagree.
- Lead with the edge cases by hand — empty, single element, duplicates,
  negatives, zero, the maximum size the constraints allow — then go random.
  ~15 hidden tests is a good target; 10 is the floor.
- Enforce the statement's guarantees inside the generator (loop until the case
  has exactly one valid pair, never call `pop` on an empty stack). A case that
  breaks a guarantee makes the reference's behaviour the specification.
- Include one case at the size the constraints allow, and state the constraint
  as the size you actually generate. A statement promising `n <= 10^5` whose
  largest test is 500 elements is a promise the tests do not keep, and it is the
  only thing standing between an accepted `O(n²)` and an `O(n)` target.
- Size that case for the trap, not for show. Where a quadratic solution is the
  plausible wrong answer, go large enough that it times out; where it is not,
  a few thousand elements is plenty and keeps `tests.json` reviewable.
- **Say which language a timeout holds in.** At `n = 10^4` a quadratic loop is
  fifty million steps: Python does not finish it in four seconds, and Java's
  JIT does in two. A statement or editorial that says "does not finish" names
  the language, or names the target complexity instead. Measure before you
  claim it — `sorted` on every window, or `bisect.insort` into a list, is C
  speed and finishes more often than the complexity suggests (P6-8).
- **Keep the helpers inside the constraints.** A generator that balances a row by
  dumping the difference on one element, or pads a word by inserting past the
  limit, produces cases the statement forbids. Clamp in the helper, not at the
  call site.
- **A hand-written case equal to a sample is dropped** from `hidden[]`, because
  Run and Submit already cover it. Change a sample, and change its hand-written
  copy in `generator.py` too, or the old input comes back as a hidden test.

## 7. Before you open a PR

- [ ] Statement is original wording, with every section and one `### Example N`
      per sample.
- [ ] Constraints are explicit, and the generator respects every one of them.
- [ ] ≥ 3 samples, each with an explanation; ≥ 10 hidden tests from the generator.
- [ ] Edge cases present: empty, single, duplicates, negatives, maximum size.
- [ ] Hints are a ladder and rung 4 is not the solution: the shape of the loop
      or recursion, not its exact conditions or a formula for the answer.
- [ ] Example inputs are invented, and the untouched Java starter passes at
      most one sample.
- [ ] Every "does not finish" claim is measured, and says which language.
- [ ] Editorial explains the approach, the complexity and the usual pitfall.
- [ ] Both references idiomatic; both starters compile; no `public class`.
- [ ] `rating` sits in its tier's band and reflects the solving time you expect.
- [ ] `npm run problems:validate <slug>` passes.
- [ ] No `TODO` anywhere in the package.

---

## 8. The drafting prompt

What to hand Claude Code when drafting a new problem. Fill in the topic,
pattern and tier; everything else is the standing brief.

> Write a DSA practice problem for DevProMax.
>
> - Topic: **\<topic\>**. Pattern: **\<pattern\>**. Tier: **\<tier\>**.
> - Mode: **\<function|operations\>**, expect **\<return|mutatedArgs|both\>**.
>
> Requirements:
>
> - Original wording throughout. Do not reproduce or paraphrase any existing
>   site's statement, examples or variable names. Invent the scenario.
> - Follow `docs/PROBLEM_FORMAT.md` exactly, and the checklist in
>   `docs/AUTHORING.md` section 7.
> - Write the constraints first, then make every example and every generated
>   case satisfy them.
> - Give me: `statement.md`, `tests.json` samples (3, each with an
>   explanation), `hints.json` (4 rungs, ladder, rung 4 is not the solution),
>   `editorial.md`, `starter.py`, `reference.py`, `starter.java`,
>   `reference.java`, `generator.py`.
> - Both references must be idiomatic in their own language, not translations
>   of each other. Java classes package-private. Do not define `ListNode`,
>   `TreeNode` or any `DevProMax*` class.
> - `generator.py` yields inputs only — never `expected` — covers the edge
>   cases explicitly before going random, and includes one case at the maximum
>   size the constraints allow.
>
> Then run `npm run problems:gen <slug>` and `npm run problems:validate <slug>`
> and fix whatever they report.

Review the result against section 7 by hand. The validator proves a problem is
_consistent_; only a person can tell whether it is _worth solving_.
