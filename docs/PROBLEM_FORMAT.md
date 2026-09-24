# Problem package format

A problem is a directory, not a database row (ROADMAP D7). This document is the
authoritative specification for what that directory contains. The machine-readable
half lives in `packages/shared` as zod schemas; `docs/schema/*.schema.json` is
generated from those schemas by `npm run problems:schema` and is what your editor
reads. If this document and the schemas ever disagree, the schemas win and this
document is the bug.

For _how_ to write a good problem — originality, difficulty calibration, the
drafting checklist — see `docs/AUTHORING.md` (ROADMAP P2-9). This document covers
only the format.

---

## 1. Directory layout

```
problems/<topic>/<slug>/
├── meta.json         required   identity, classification, judging configuration
├── statement.md      required   the problem as the user reads it
├── tests.json        required   samples (visible) and hidden tests
├── hints.json        required   the static hint ladder
├── editorial.md      required   approach, complexity, pitfalls
├── starter.py        required   Python starting point
├── starter.java      required   Java starting point
├── reference.py      required   Python solution that must pass every test
├── reference.java    required   Java solution that must pass every test
├── generator.py      optional   random-input generator; the source of hidden[]
├── checker.ts        optional   custom comparator (required if comparator is `checker`)
└── assets/           optional   images referenced by statement.md or editorial.md
```

`<topic>` is one of the fourteen curriculum topic slugs (see
`packages/shared/src/curriculum.ts`); `<slug>` is lowercase kebab-case and must
match `meta.slug`. The directory name is the slug — there is no second source of
truth for it.

---

## 2. `meta.json`

```json
{
  "$schema": "../../../docs/schema/meta.schema.json",
  "id": "pair-sum-index",
  "slug": "pair-sum-index",
  "title": "Pair Sum Index",
  "version": 1,
  "topic": "arrays",
  "patterns": ["hash map", "complement lookup"],
  "tier": "Easy",
  "rating": 2,
  "order": 0,
  "mode": "function",
  "entry": "pairSumIndex",
  "expect": "return",
  "comparator": "exact",
  "limits": { "timeoutMs": { "python": 4000, "java": 2000 } },
  "related": ["three-sum-zero"],
  "targetComplexity": { "time": "O(n)", "space": "O(n)" }
}
```

| Field              | Required | Notes                                                                                                                                        |
| ------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `$schema`          | no       | Editor convenience only; ignored by the loader.                                                                                              |
| `id`               | yes      | **Stable forever.** Submissions and progress rows reference it. Renaming a problem changes the `slug`, never the `id`.                       |
| `slug`             | yes      | URL and directory name, lowercase kebab-case, 3–64 chars. Unique across the catalogue.                                                       |
| `title`            | yes      | 3–120 chars, title case, original wording.                                                                                                   |
| `version`          | yes      | Integer ≥ 1. **Bump whenever `tests.json` changes.** Submissions record the version they were judged against so history stays interpretable. |
| `topic`            | yes      | One of the 14 curriculum topics. Must match the parent directory.                                                                            |
| `patterns`         | yes      | At least one; free text, searchable (`"two pointers"`, `"monotonic stack"`).                                                                 |
| `tier`             | yes      | `Easy` / `Medium` / `Hard`.                                                                                                                  |
| `rating`           | yes      | Integer 1–10 and **must fall inside the tier's band**: Easy 1–3, Medium 4–7, Hard 8–10. A mismatch is a validation error, not a warning.     |
| `order`            | yes      | Position within the topic's learning path (0-based).                                                                                         |
| `mode`             | yes      | `function` or `operations` (§4).                                                                                                             |
| `entry`            | yes      | `function` mode: the method name on `Solution`. `operations` mode: the class name to construct.                                              |
| `expect`           | yes      | `return`, `mutatedArgs` or `both`. `operations` mode must use `return`.                                                                      |
| `comparator`       | no       | Defaults to `"exact"` (§6).                                                                                                                  |
| `limits`           | no       | Per-language wall-clock budget per test. Defaults: Java 2000 ms, Python 4000 ms.                                                             |
| `related`          | no       | Slugs of related problems; may not contain this problem's own slug.                                                                          |
| `targetComplexity` | no       | Quoted to the coach as the bar the user's solution has to meet. Strongly recommended.                                                        |

Unknown keys are rejected. A typo like `"paterns"` fails validation rather than
being silently dropped.

---

## 3. `statement.md`

Original wording only (ROADMAP D8). Never paste a LeetCode statement, and do not
paraphrase one sentence by sentence — restate the underlying task with our own
framing, our own variable names and our own examples.

Structure, in this order:

```markdown
Prose statement of the objective, 1–3 short paragraphs. Second person
("You are given…"). No preamble, no story framing longer than one sentence.

## Input

- `nums` — list of integers, `1 <= nums.length <= 10^5`
- `target` — integer, `-10^9 <= target <= 10^9`

## Output

Prose description of the return value, and of any in-place mutation the judge
checks.

## Constraints

- `1 <= nums.length <= 10^5`
- Exactly one valid answer exists.

## Examples

### Example 1

Input: `nums = [2, 7, 11, 15]`, `target = 9`
Output: `[0, 1]`

`nums[0] + nums[1] == 9`, so the indices are returned in ascending order.
```

Rules:

- **The `## Examples` section corresponds 1:1 with `samples[]`, in the same
  order.** One `### Example n` heading per sample. The validator checks that the
  counts match, which is the cheap half of keeping them in step; the expensive
  half is on you — if you add a sample, add the example.
- Constraints must be _real_: they bound what `generator.py` produces and what
  the limits allow. "n is small" is not a constraint.
- Images live in `assets/` and are referenced relatively (`![](assets/grid.png)`).
  The API serves them from `/api/problems/<slug>/assets/*`.
- Inline math uses `$…$` and is rendered with KaTeX. Use it sparingly; `O(n log n)`
  in backticks reads better than a formula.

---

## 4. Test modes

### 4.1 `function` mode

The harness constructs `Solution()` once per test and calls `entry` with the
arguments in `args`, in order.

```json
{ "args": [[2, 7, 11, 15], 9], "expected": [0, 1], "explanation": "…" }
```

`args` is _always_ an array, one element per parameter, even for a single
parameter: `"args": [[1, 2, 3]]` passes one list, `"args": [1, 2, 3]` passes
three integers.

### 4.2 `operations` mode

For design problems (LRU cache, MinStack, Trie, Union-Find, streaming medians).
The harness constructs `entry` with `args`, then applies each entry of `ops` in
order and collects every return value.

```json
{
  "args": [2],
  "ops": [
    { "method": "put", "args": [1, 1] },
    { "method": "put", "args": [2, 2] },
    { "method": "get", "args": [1] },
    { "method": "put", "args": [3, 3] },
    { "method": "get", "args": [2] }
  ],
  "expected": [null, null, 1, null, -1],
  "explanation": "Inserting key 3 evicts key 2, the least recently used."
}
```

`expected` has **exactly one entry per op**. Void methods contribute `null`.
`args` on an op may be omitted for a no-argument method.

### 4.3 Expectation modes

| `expect`      | What the judge compares                                                        |
| ------------- | ------------------------------------------------------------------------------ |
| `return`      | The value returned by `entry` (or the list of op returns).                     |
| `mutatedArgs` | Only the arguments the solution mutated in place. The return value is ignored. |
| `both`        | Return value _and_ mutated arguments; both must match.                         |

Mutated arguments are addressed **by index**, not by a parallel array:

```json
{
  "args": [[1, 2, 3, 4, 5], 2],
  "expectedMutatedArgs": [{ "index": 0, "value": [4, 5, 1, 2, 3] }]
}
```

An index that is not listed is not checked. This is why the format is a list of
`{index, value}` rather than an array the same length as `args`: `null` is a
legal value, so a sparse array could not distinguish "expected to become null"
from "not checked".

For `both` problems such as "remove duplicates and return the new length", the
return value is the length and the mutated argument is the whole array; if only a
prefix of the array is meaningful, use a `checker` (§6) rather than pretending the
tail is defined.

---

## 5. `tests.json` and the wire format

```json
{
  "$schema": "../../../docs/schema/tests.schema.json",
  "samples": [ … ],
  "hidden": [ … ]
}
```

- `samples` — visible in the statement and run by the **Run** button. **At least
  three**, each with an `explanation`.
- `hidden` — run by **Submit**. **At least ten**, normally produced by
  `generator.py` (`npm run problems:gen <slug>`) rather than hand-written.
- `name` is optional on any test and is shown in the results panel
  (`"empty input"`, `"all duplicates"`).

Every value on the wire is plain JSON. Anything that cannot be expressed in JSON
cannot be a test input, and `NaN` / `Infinity` are rejected outright — they have
no JSON encoding and would silently become `null` inside a harness.

### 5.1 Type mapping

| Concept                | JSON                                    | Python               | Java                               |
| ---------------------- | --------------------------------------- | -------------------- | ---------------------------------- |
| integer                | `5`                                     | `int`                | `int` / `long`                     |
| float                  | `2.5`                                   | `float`              | `double`                           |
| boolean                | `true`                                  | `bool`               | `boolean`                          |
| character              | `"a"` (1-char string)                   | `str`                | `char`                             |
| string                 | `"abc"`                                 | `str`                | `String`                           |
| int array              | `[1, 2, 3]`                             | `list[int]`          | `int[]` or `List<Integer>`         |
| 2-D int array / matrix | `[[1, 2], [3, 4]]`                      | `list[list[int]]`    | `int[][]` or `List<List<Integer>>` |
| char grid              | `[["a", "b"], ["c", "d"]]`              | `list[list[str]]`    | `char[][]`                         |
| string array           | `["a", "bc"]`                           | `list[str]`          | `String[]`                         |
| linked list            | `[1, 2, 3]`                             | `Optional[ListNode]` | `ListNode`                         |
| list of linked lists   | `[[1, 2], [3]]`                         | `List[ListNode]`     | `ListNode[]`                       |
| binary tree            | `[6, 2, 14, null, null, 11, 18]`        | `Optional[TreeNode]` | `TreeNode`                         |
| graph                  | `[[0, 1], [1, 2]]` plus an `n` argument | `list[list[int]]`    | `int[][]`                          |
| absent / void          | `null`                                  | `None`               | `null`                             |

Java picks the conversion from the **declared parameter type** by reflection
(ROADMAP D5); Python deserialises JSON natively and applies a helper only for
`ListNode`/`TreeNode` parameters. The starter's signature is therefore the source
of truth for argument typing in both languages — if the two starters disagree
about a parameter's type, the validator catches it when the references run.

Python annotations are read **recursively**, so `Optional[ListNode]`,
`List[ListNode]`, `ListNode | None` and `Optional[List[TreeNode]]` all decode
(ROADMAP P2-12). A plain string annotation works too, which is what
`from __future__ import annotations` and a quoted forward reference produce.

**Integers on the wire are bounded to |n| ≤ 2^53 − 1** (ROADMAP D22). Every
value crosses the boundary as JSON and is parsed into a double, so a larger
integer is not the integer it was written as: two different 64-bit answers can
compare equal, and Java's reader throws on a Node-stringified 2^63. The
validator rejects any test value outside the range. A problem whose answer would
exceed it is phrased modulo 10^9+7, as interview problems usually are.

Java refuses rather than truncates: `2.5` for an `int` parameter is an error,
not `2`, and a `char[]` element that is not exactly one character says which
index it was.

Supported Java types, exhaustively:

```
int, long, double, boolean, char, String,
int[], int[][], long[], double[], char[], char[][], String[],
List<Integer>, List<List<Integer>>, List<String>,
ListNode, TreeNode, ListNode[]
```

Anything outside this table is a format error. Extending it means extending the
Java harness in `apps/server/src/judge`, updating this list, and adding a judge
integration test.

### 5.2 Linked lists

A linked list is the array of its values, head first. `[]` is an empty list
(`None` / `null` head).

**A cycle is declared, not encoded** (ROADMAP P2-15). The array cannot say "the
tail points back at index k", so the problem says it instead: `meta.cycle` names
two argument slots, and the harness closes the chain while building it.

```json
{ "entry": "hasCycle", "expect": "return", "cycle": { "chain": 0, "at": 1 } }
```

`chain` is the argument holding the values; `at` is the argument holding the
position the tail links back to, or `-1` for an open chain. The index is
**consumed by the harness** rather than passed on, so the solution is called with
exactly the signature the starter declares - one parameter, the head of a chain
that happens to loop:

```json
{ "args": [[5, 8, 1, -6], 1], "expected": true }
```

Four nodes, the last pointing at the second. `-1` builds an ordinary chain, and
an index past the end is a generator bug: the validator says so, and the harness
raises rather than linking to nothing.

Two limits come with this. A problem with a cycle must `expect: "return"` - the
encoder refuses to serialise a cyclic argument rather than writing forever, so
`mutatedArgs` has nothing to compare - and the values still cross as values:
this carries _construction instructions_, not object identity. That is why a
clone-the-graph problem is still not expressible. Telling a copy from the
original needs identity, and by the time a returned graph reaches the comparator
it is an edge list, indistinguishable from the one that went in (see §5.4).

### 5.3 Binary trees

Level-order with explicit `null` for absent children, trailing nulls omitted:

```
      6
     / \
    2   14
       /  \
      11   18
```

is `[6, 2, 14, null, null, 11, 18]`. `[]` is an empty tree. A `null` in the middle
of the array means "this position has no node", and its children are not listed.

### 5.4 Graphs

Graphs are passed as an edge list plus the vertex count, because an adjacency
list alone cannot express isolated vertices:

```json
{
  "args": [
    5,
    [
      [0, 1],
      [1, 2],
      [3, 4]
    ]
  ],
  "expected": 2
}
```

Weighted edges are `[u, v, w]`. Whether the graph is directed is a property of the
problem statement, not of the encoding.

**There is no graph node type, and a clone problem cannot be expressed** (ROADMAP
P2-15). A vertex is an integer on this wire, so a solution never holds a node
object to copy - and even if it did, the answer would come back as an edge list,
where a genuine clone and the input itself are the same bytes. "Return a copy of
this graph" has no observable answer here: returning the argument passes.

Making it expressible would mean a node type in the reflection table (D5) _and_
an identity assertion inside both harnesses - a fourth `expect` mode used by one
problem. `clone-the-graph` was dropped instead (see `docs/CURRICULUM.md`); the
skill it teaches, a traversal that carries a map from old to new, is covered by
the tree and DFS problems that are expressible. A checker (D6) cannot rescue it:
checkers see the wire values, which is exactly where the distinction is lost.

### 5.5 Edge cases every problem must cover

`hidden[]` must include, where the constraints allow them:

- the empty input,
- a single-element input,
- the maximum size the constraints permit,
- duplicates,
- negative numbers (or the lower bound of the value range),
- the boundary of any special-cased branch in the reference solution.

`npm run problems:validate` enforces the counts; the generator and the authoring
checklist enforce the substance.

---

## 6. Comparators

`comparator` decides how expected and actual are compared. Option-less kinds may
be written as a bare string.

| Kind                   | Form                                        | Use when                                                                                              |
| ---------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `exact`                | `"exact"`                                   | Default. Deep structural equality.                                                                    |
| `unorderedList`        | `"unorderedList"`                           | The answer is a set: "return all indices", "return the subsets". Order within the list is irrelevant. |
| `unorderedListOfLists` | `"unorderedListOfLists"`                    | Neither the outer nor the inner order matters (subsets, permutations, groups of anagrams).            |
| `floatTolerance`       | `{ "kind": "floatTolerance", "eps": 1e-6 }` | The answer is a real number. `eps` is required and must be positive.                                  |
| `checker`              | `"checker"`                                 | Multiple correct answers that no comparator above captures. Requires `checker.ts`.                    |

`checker.ts` exports a default function run **in-process by the judge** (ROADMAP
D6) — it is our TypeScript, never user code:

```ts
import type { CheckerFn } from '@devpromax/shared';

const check: CheckerFn = ({ input, expected, actual }) => {
  if (!Array.isArray(actual))
    return { pass: false, message: 'expected an array' };
  return { pass: true };
};

export default check;
```

Return `{ pass: false, message }` with a message that says what was wrong, not
just "incorrect" — it is shown to the user.

---

## 7. `hints.json`

```json
{
  "hints": [
    "What would you need to know to decide, in one pass, whether a complement has already been seen?",
    "A hash map from value to index answers that in O(1).",
    "Scan once. Before inserting nums[i], check whether target - nums[i] is already a key.",
    "Insert after checking, so a value cannot pair with itself."
  ]
}
```

One rung per entry, weakest first, revealed one at a time by the Hints tab (P7-1).
Four rungs matching the ladder (nudge → concept → approach → pseudocode) is the
norm. **No rung may contain the full solution**; the editorial is where that
lives. The coach treats this ladder as canonical and adapts it to the user's
actual code, and it is the fallback when no API key is configured.

---

## 8. `editorial.md`

```markdown
## Approach

The insight, in prose, before any code.

## Complexity

- Time: `O(n)` — one pass, each lookup amortised `O(1)`.
- Space: `O(n)` — the map holds at most n entries.

## Pitfalls

- Inserting before checking lets an element pair with itself.

## Why the naive approach is not enough

Optional, but include it when the brute force is the tempting answer.
```

Reference code is **not** pasted into the editorial: the Editorial tab renders
`reference.py` and `reference.java` directly from disk, so there is one copy.
The editorial unlocks after Solved or an explicit reveal (P7-2), and its approach
section is passed to the coach flagged as secret.

---

## 9. Starters and references

### Python

```python
from typing import List, Optional

# Provided by the judge; do not redefine:
# class ListNode:
#     def __init__(self, val=0, next=None): ...
# class TreeNode:
#     def __init__(self, val=0, left=None, right=None): ...


class Solution:
    def pairSumIndex(self, nums: List[int], target: int) -> List[int]:
        pass
```

- Must run on Python 3.10 (CLAUDE.md > Environment): no `match` on structural
  patterns newer than 3.10, no PEP 695 generics, no `itertools.batched`.
- Use `List[int]` from `typing` rather than `list[int]` in signatures, so the
  starter reads the same on every supported version.
- `ListNode` and `TreeNode` are injected by the harness and shown as comments in
  the starter. Redefining them is an error in both languages, reported as a
  compile error in Java that names the class.

### Java

```java
import java.util.*;

class Solution {
    public int[] pairSumIndex(int[] nums, int target) {
        // Replace this placeholder with your answer.
        return new int[0];
    }
}
```

- Compiled with `--release 21`. The class is `Solution` (or the `entry` class in
  `operations` mode) and must not be `public` — the harness compiles it alongside
  its own entry point.
- Helper classes in the same file are fine and encouraged; the harness keeps its
  own out of the way under `DevProMax*` names. The four names the workspace
  already holds are `DevProMaxMain`, `DevProMaxJson`, `DevProMaxConvert` and the
  two types below; declaring one is reported as a compile error naming it.
- **A non-void Java starter must return something.** An empty body is a compile
  error in Java, and the validator requires starters to compile (§11). Use a
  cheap placeholder with a comment, as above. The payoff is that Run on an
  untouched starter gives the user a Wrong Answer they can read, instead of a
  compile error that tells them nothing about the problem.
- `import java.util.*;` is always present in the starter, even when unused.
- The method signature is what the harness reflects on, so parameter types must
  come from the supported-type table in §5.1.

### References

`reference.py` and `reference.java` are complete, idiomatic solutions that meet
`targetComplexity`. They are not just correct — they are what the editorial
describes and what the coach implicitly holds the user to, so a reference that
"works but is ugly" is a bug. `npm run problems:validate` runs both against every
test and refuses to pass a problem where either fails.

---

## 10. `generator.py`

Optional but expected for every problem (ROADMAP D9). It produces the hidden
tests, using the reference solution as the oracle.

```python
import random
from typing import Any, Iterator


def generate(rng: random.Random) -> Iterator[dict[str, Any]]:
    """Yield {"args": [...]} dicts. Expected values are filled in by the runner."""
    yield {"args": [[], 0], "name": "empty"}
    yield {"args": [[1], 1], "name": "single element"}
    for _ in range(12):
        n = rng.randint(2, 200)
        nums = [rng.randint(-1000, 1000) for _ in range(n)]
        i, j = rng.sample(range(n), 2)
        yield {"args": [nums, nums[i] + nums[j]]}
```

`npm run problems:gen <slug>` runs `generate`, computes `expected` by calling
`reference.py`, and rewrites `hidden[]`. Deterministic seeding means regenerating
without changing the generator produces the same tests. **Bump `meta.version`
whenever the generated tests change.**

---

## 11. Validation

```
npm run problems:validate --static [slug]        # schema and structure only, no subprocesses
npm run problems:validate [slug]                 # the above, plus both references through the judge
npm run problems:validate -- --changed <ref>     # reference runs only for problems that differ from <ref>
npm run problems:schema [--check]                # regenerate (or verify) docs/schema/*.schema.json
npm run problems:gen -- --check [slug]           # fail if tests no longer match their generator
```

Reference runs are four at a time, and `--changed` narrows _them_ only (D23):
the static rules always cover the whole catalogue, because that is where the
cross-problem checks live — a duplicate id, a dangling `related`, two problems
claiming one `order`. A change under `apps/server/src/judge/`,
`apps/server/src/problems/`, `packages/shared/` or to any `checker.ts` validates
everything, since those decide what "passes" means for problems nobody touched.

`problems:gen --check` regenerates and compares, which is the only thing that
catches an edited `generator.py` with a stale `tests.json`. It refuses to run on
a Python minor other than the one in `problems/GENERATED_WITH`:
`random.Random`'s sequence methods are not stable across minors, so a
regeneration elsewhere differs for reasons that mean nothing.

Static checks (P1-2):

1. Every required file is present and parses.
2. `meta.json` matches the schema, including the tier/rating band and unknown-key rejection.
3. `slug` matches the directory name; `topic` matches the parent directory.
4. `id` and `slug` are unique across the catalogue.
5. `samples.length >= 3`, every sample has an `explanation`; `hidden.length >= 10`.
6. Comparator and expect combinations are legal: `operations` implies
   `expect: "return"`; a `checker` comparator requires `checker.ts`;
   `floatTolerance` requires a positive `eps`.
7. `expect: "mutatedArgs"` or `"both"` requires `expectedMutatedArgs` on every test;
   `expect: "return"` or `"both"` requires `expected` on every test.
8. In `operations` mode every test has `ops`, and `expected.length === ops.length`.
9. `related` slugs resolve to problems that exist.
10. Assets referenced from `statement.md` and `editorial.md` exist in `assets/`.
11. No file still contains a `TODO` from the scaffold.
12. Every integer on the wire is inside |n| ≤ 2^53 − 1 (D22).
13. `hints.json` has four rungs and none of them contains code — detected
    structurally (a fenced block, a method call, an assignment to an element, a
    lambda, a statement terminator), not by looking for English keywords.
14. Each example puts `Input:` and `Output:` in separate paragraphs, because a
    single newline renders as one run-on line.
15. `editorial.md` has `## Approach` and `## Complexity`.
16. No hidden test repeats a sample — same `args` _and_ same `ops` — since
    Submit would then run it twice.
17. In `operations` mode every `ops[].method` is declared in both starters.
18. The largest hidden input reaches at least half of any size bound the
    Constraints section states (D21, a warning), and `tests.json` is under 2 MB
    (also a warning).

Full checks add (P2-7): both references pass every sample and hidden test in both
languages, and both starters compile (Java) or import (Python).

Every error message names the file and, where the format allows it, the JSON
path — `problems/arrays/pair-sum-index/meta.json: rating 4 is outside the Easy band`.

---

## 12. Changing an existing problem

| Change                                  | `version` bump | Notes                                                           |
| --------------------------------------- | -------------- | --------------------------------------------------------------- |
| Typo in `statement.md`                  | no             |                                                                 |
| New or changed hidden test              | **yes**        | Old submissions keep their recorded version.                    |
| New sample                              | **yes**        | Samples are run by Run and are part of the contract.            |
| Changed comparator, `expect` or `entry` | **yes**        | Also update both starters and both references.                  |
| Changed `limits`                        | no             | Timing is environmental, not part of the contract.              |
| Renamed slug                            | no             | `id` must not change. Add a redirect if the old URL was shared. |
| New hint rung                           | no             |                                                                 |
