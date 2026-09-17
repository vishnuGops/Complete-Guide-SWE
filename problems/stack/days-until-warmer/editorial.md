## Approach

Checking every later day for each day is `O(n^2)` and repeats a lot of work: the
same warm day gets discovered separately by every cold day before it.

Turn it around. Keep the days that are still waiting for an answer, as indices.
When a new day arrives, it answers *every* waiting day colder than it - pop them
and write down the distance. Then the new day starts waiting too.

The days on that stack are always in non-increasing temperature order, which is
what makes the popping safe to stop early: the first waiting day that is not
colder than today means none below it are either. Each day is pushed once and
popped at most once, so the whole thing is linear despite the inner loop.

Days still on the stack at the end never got warmer, and their answer is the `0`
the result was initialised with.

## Complexity

- Time: `O(n)` - each index is pushed and popped at most once.
- Space: `O(n)` for the stack, in the worst case of a strictly cooling log.

## Pitfalls

- Popping on `>=` rather than `>` treats an equal day as warmer, which the
  statement rules out.
- Storing temperatures on the stack instead of indices leaves no way to compute
  the distance.
- Writing the distance as the popped index rather than the difference between the
  two indices.
