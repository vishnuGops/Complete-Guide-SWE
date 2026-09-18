# Merge K Ordered Chains

## Approach

Merging two chains is a comparison between two heads. Merging `k` chains is the
same question with a bigger candidate set: **the next link of the answer is
always the smallest of the `k` current heads**, and taking it changes that set by
exactly one element.

A min-heap is the structure for that. Seed it with every non-empty chain's head;
then repeatedly pop the smallest, append it to the result, and push that link's
successor if it has one. The heap never holds more than `k` links, and each of
the `N` links is pushed and popped exactly once — `O(N log k)` time, `O(k)`
space.

```
heap = min-heap of the non-empty heads, by value
dummy = new link; tail = dummy
while heap is not empty:
    node = heap.pop()
    tail.next = node; tail = node
    if node.next is not null: heap.push(node.next)
tail.next = null
return dummy.next
```

`tail.next = null` at the end matters for the same reason as in
`partition-around`: the last link still carries its original `next`, pointing
into a chain that has already been consumed.

**The other answer** is a tournament: merge the chains in pairs, then merge the
results in pairs, and so on. After `log k` rounds one chain remains, and each
round touches every link once — `O(N log k)` again, with no heap at all. It is
the better answer when the merge of two is already written, and it is how merge
sort works.

**The answer to avoid** is folding the chains in one at a time. Merging chain `i`
into a result that already holds `i` chains' worth of links re-walks all of them,
so the total is `O(k · N)`. At the stated maxima that is fifty million steps and
does not finish.

## Complexity

- Time: `O(N log k)` where `N` is the total number of links.
- Space: `O(k)` for the heap.

## Pitfalls

- **Seeding the heap with empty chains.** A null head has no value to key on.
- **A heap of raw links in a language without a comparator.** In Python the
  entries must be tuples with a tie-breaker, because `ListNode` has no ordering
  and comparing two of them raises.
- **Not terminating the result.** A cycle, and a hang.
- **Collecting all the values, sorting, rebuilding.** `O(N log N)` and `O(N)`
  space, and it throws away the sortedness that the chains already have.
