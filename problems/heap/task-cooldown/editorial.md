# Tasks With A Cooldown

## Approach

The schedule is decided by the **most frequent task**. Say it occurs `m` times.
Between consecutive runs of it, `cooldown` other ticks must pass, so its runs lay
down a skeleton:

```
[ a ...cooldown ticks... ][ a ...cooldown ticks... ] ... [ a ]
   ^ m - 1 blocks of (cooldown + 1) ticks             ^ the last run
```

That is `(m - 1) · (cooldown + 1) + 1` ticks. If another task also occurs `m`
times, it must sit beside every `a`, which adds one tick to the end of the
schedule — so add one for each task tied at `m`:

```
skeleton = (m - 1) · (cooldown + 1) + (how many tasks occur m times)
```

The remaining tasks go into the gaps. Either they fit, and the answer is the
skeleton; or there are more of them than the gaps hold, in which case the gaps
overflow — and once no gap is empty there is no idling anywhere, so the answer is
just the number of tasks. Taking the larger of the two covers both:

```
answer = max(tasks.length, skeleton)
```

One pass to count, then arithmetic: `O(n)` time and `O(1)` space.

**The heap version**, which is what this topic is about, computes the same
number by simulating _rounds_ rather than ticks: each round takes up to
`cooldown + 1` of the most frequent remaining tasks, runs them, and pushes back
whatever still has runs left. There are at most `n` rounds, so it is
`O(n log 26)` — and it has the advantage of producing an actual schedule, which
the formula does not.

**What does not work** is simulating tick by tick. At the stated maxima — one
task ten thousand times with a cooldown of ten thousand — that is about `10^8`
ticks, and it does not finish.

## Complexity

- Time: `O(n)`.
- Space: `O(1)` — 26 counters.

## Pitfalls

- **Forgetting the tasks tied for most frequent.** `"aabb"` with a cooldown of 2
  is 5, not 4: the second `b` has to follow the second `a`.
- **Forgetting the `max`.** With many different tasks the gaps overflow and there
  is no idling; the skeleton then _underestimates_.
- **A cooldown of 0.** The answer is the number of tasks, which the formula gives
  because `cooldown + 1` is 1.
- **Simulating tick by tick.**
