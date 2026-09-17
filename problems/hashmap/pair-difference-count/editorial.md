## Approach

Given one value, the value that would complete a pair is determined: it is
`v + gap`. So the question is only ever "is that value present", which a hash set
answers in constant time.

Iterating over the **distinct** values rather than over the list is what keeps
the count by value: a value appearing five times asks its question once.

The `gap = 0` case is different in kind rather than degree. The candidate is `v`
itself, so membership is always true and would count every value. What is needed
there is whether `v` occurs at least twice, which means counting occurrences
rather than recording presence.

## Complexity

- Time: `O(n)` - one pass to build the counts, one over the distinct values.
- Space: `O(n)`.

## Pitfalls

- Iterating the list instead of the distinct values counts a pair once per
  duplicate.
- Treating `gap = 0` like any other gap counts every value as a pair with itself.
- Checking both `v + gap` and `v - gap` counts every pair twice.
