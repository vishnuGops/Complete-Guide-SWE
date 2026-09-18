# Largest Number Made Of

## Approach

The answer is a permutation, so the question is only ever "which of these two
parts goes first?". Comparing the parts as numbers does not answer it: between
`3` and `30`, neither is obviously first, and length does not decide it either —
`9` beats `34` despite being shorter.

What does decide it is the thing being built. Between `a` and `b`, there are
exactly two outcomes for that pair: the text `a + b` or the text `b + a`. Pick
whichever is larger as a string, and that is the order.

```
sort parts so that (a + b) > (b + a) as text
join and return
```

Two things make this more than a trick:

**It is a real ordering.** The relation is transitive — if `ab > ba` and
`bc > cb` then `ac > ca` — which is what makes it safe to hand to a sort. A
comparator that is not transitive can make a sort produce nonsense or crash
outright (Java's `TimSort` throws "Comparison method violates its general
contract" for exactly this).

**Comparing strings of different lengths is fine here.** `a + b` and `b + a` are
always the same length, so a plain lexicographic comparison is also the numeric
one.

The one special case is zeroes. `[0, 0]` sorts to `"00"`, which is the right
digits and the wrong number; if the largest part is `0`, the answer is `"0"`.
Checking the first character of the result is the cheapest way to catch it.

## Complexity

- Time: `O(n log n · L)` where `L` is the length of the longest part.
- Space: `O(n · L)` for the string forms.

## Pitfalls

- **Sorting numerically, descending.** `[3, 30]` gives `"303"`; the answer is
  `"330"`.
- **Sorting by length first.** `[9, 34]` gives `"349"`; the answer is `"934"`.
- **Forgetting the all-zero case.** `"000"` is not a number.
- **Returning an integer.** Two hundred parts of ten digits is a 2000-digit
  number, which is why the answer is text.
