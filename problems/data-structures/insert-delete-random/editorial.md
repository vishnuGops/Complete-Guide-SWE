# Add, Remove, Pick At Random

## Approach

Each operation on its own is easy and the three together are the problem:

- **`pick` in `O(1)`** needs the members in a flat array, so one can be reached
  by index.
- **`add` and `remove` in `O(1)`** need a hash map, so membership is a look-up.
- **Removing from the middle of an array** is `O(n)` because everything after the
  hole shifts down.

The resolution is that **the array's order does not matter**. Nothing about the
problem depends on it, so a removal need not shift anything: move the _last_
element into the hole and drop the last slot.

```
values : array of the members
where  : map from value to its index in that array

add(v):    if v in where: return false
           where[v] = values.length; values.append(v); return true

remove(v): if v not in where: return false
           hole = where[v]; last = values[-1]
           values[hole] = last; where[last] = hole      # fill the hole
           values.pop(); where.remove(v)
           return true

pick():    return values[random index]
```

**The two structures have to be kept in step.** `where[last] = hole` is the line
that is forgotten, and forgetting it leaves the map pointing at where the moved
element _used_ to be — which corrupts the next removal rather than the current
one, and is therefore hard to find. Two structures describing the same thing is
the recurring hazard of this kind of design, and keeping their update in one
place is the defence.

**Removing the last element** is the case worth tracing by hand: the hole _is_
the last slot, the "move" copies the element onto itself, and the order of the
pop and the map deletion decides whether it works. Doing the array write first
and the map delete last is safe.

## Complexity

- Time: `O(1)` per operation.
- Space: `O(n)`.

## Pitfalls

- **Not updating the moved element's index.** The next removal breaks.
- **Removing from the map before reading the index.**
- **Scanning the array for the value.** That is the `O(n)` removal the design
  exists to avoid.
- **Assuming the array stays in insertion order.** It deliberately does not.

## What the tests can and cannot see

`pick` may return any member, so its answer is checked by a property rather
than a value: the checker replays the calls and accepts any `pick` that returns
a value in the set at that moment. That catches a wrong `add` or `remove` and a
`pick` of something already removed, but it cannot see _how_ the value was
chosen. A plain hash set that returns, say, its first member on every `pick`
passes, although it is neither `O(1)` random access nor random at all, and so
does one that copies the set into a list on every call. Telling uniform from
fixed would take many calls and a statistical test, which a single run cannot
settle without flaking. The array-and-map design is what the problem asks for;
the tests hold you to its answers, and this editorial to its shape.
