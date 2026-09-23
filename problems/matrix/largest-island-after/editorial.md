# Largest Island If You Fill

## Approach

Filling a water cell merges every island that touches it, plus the cell itself.
So if the size of each island were known, every water cell could be answered in
constant time — and the islands can be measured once, up front.

**Two passes.**

1. **Label and measure.** Flood-fill each island once, writing a distinct label
   into every one of its cells and recording that label's size. Using labels
   starting at 2 lets them be stored in the grid itself, since 0 and 1 are
   already taken.
2. **Try each water cell.** For a cell holding 0, look at its four neighbours,
   collect their **distinct** labels, and the result is `1 + the sum of those
islands' sizes`.

The answer is the largest value seen in pass 2 — or, if there is no water at all,
the largest island from pass 1.

**Distinct is the whole trick.** A water cell can have two neighbours belonging to
the same island — a `U` shape around it, for instance — and adding that island's
size twice is the natural wrong answer. Collecting the labels into a small set
first (at most four elements) fixes it.

Union-find is the other standard way to get the labels and sizes, and is the
better tool when land is being _added_ repeatedly rather than measured once. Here
a single flood fill is simpler and has the same cost.

**Why not fill and re-measure.** Trying each water cell and flood-filling around
it costs `O(rows · columns)` per cell and there are up to `rows · columns` of
them — a hundred million cell visits at the stated maximum, which does not
finish. The labelling turns the same question into two linear passes.

## Complexity

- Time: `O(rows · columns)`.
- Space: `O(rows · columns)`.

## Pitfalls

- **Counting one island twice.** The reason for the set of labels.
- **Forgetting the all-land case.** With no water to fill, the answer is the
  largest existing island, and a loop over water cells never runs.
- **Labelling from 1.** Labels have to be distinguishable from the land marker;
  start at 2.
- **A recursive fill.** An all-land grid is one island of ten thousand cells.
