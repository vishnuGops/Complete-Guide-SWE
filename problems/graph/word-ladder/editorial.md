# One Letter At A Time

## Approach

Every step costs the same, so the shortest ladder is a **breadth-first search**
from `start`, where a word's neighbours are the list words differing from it in
exactly one position.

**The trap is finding the neighbours.** Comparing a word against every other word
is `O(words · length)` per step and `O(words² · length)` overall — over two
hundred million character comparisons at the stated maxima.

**The blanked-out form** avoids all of it. For each position, replace that letter
with a placeholder: `hot` gives `*ot`, `h*t` and `ho*`. Two words differ in
exactly one position precisely when they share one of these forms. So build the
index once:

```
buckets = {}                        # blanked form -> the words matching it
for word in words:
    for i in 0 .. length-1:
        buckets[word[:i] + "*" + word[i+1:]].append(word)
```

and then a word's neighbours are `length` map look-ups rather than a scan.
Building the index is `O(words · length²)` — each of `length` forms costs
`length` to construct — and the search itself visits each word once.

**Mark words as seen when they are queued**, not when they are dequeued; a word
reachable from many others would otherwise enter the queue many times. Removing a
bucket after it has been used once is an equivalent trick and is often tidier.

**The two cases that decide the edge conditions**: `target` must be in the list
or the answer is `0`, whatever the words look like; and `start` equal to `target`
answers `1` because the ladder is counted in words, not steps.

Searching from both ends at once — alternating, always expanding the smaller
frontier — roughly halves the exponent of the explored set and is the standard
next step when this shape appears at scale.

## Complexity

- Time: `O(words · length²)`.
- Space: `O(words · length)` for the index.

## Pitfalls

- **Comparing every pair of words.**
- **Counting steps rather than words.** The example ladder has four steps and
  answers 5.
- **Forgetting to check the target is in the list.**
- **Marking on dequeue.** The queue fills with duplicates on a dense list.
