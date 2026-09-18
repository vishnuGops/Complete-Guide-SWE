"""Random inputs for minimum-swaps-sorted.

Every row is distinct, as the statement requires. The shapes that matter: sorted
(zero swaps), reversed, a single long cycle (n - 1 swaps), many small cycles,
and a maximum-size shuffle where simulating a selection sort cannot finish.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(values: List[int], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [values]}
    if name:
        case["name"] = name
    return case


def _rotated(n: int) -> List[int]:
    """One cycle covering everything, so the answer is n - 1."""
    return list(range(1, n)) + [0]


def _paired(rng: random.Random, n: int) -> List[int]:
    """Disjoint transpositions, so the answer is about n / 2."""
    values = list(range(n))
    positions = list(range(n))
    rng.shuffle(positions)
    for i in range(0, n - 1, 2):
        a, b = positions[i], positions[i + 1]
        values[a], values[b] = values[b], values[a]
    return values


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([5], "a single reading")
    yield _case([1, 2, 3], "already sorted")
    yield _case([2, 1], "one swap")
    yield _case([4, 3, 2, 1], "reversed")
    yield _case([-(10**9), 10**9], "the extremes of the stated range, in order")
    yield _case([10**9, -(10**9)], "the extremes, out of order")
    yield _case(_rotated(7), "a single cycle covering everything")

    for n in (5, 16, 50, 200):
        values = list(range(n))
        rng.shuffle(values)
        yield _case(values)

    yield _case(_paired(rng, 300), "disjoint pairs only")
    yield _case(_rotated(500), "one long cycle")

    for _ in range(2):
        n = rng.randint(1000, 4000)
        values = rng.sample(range(-(10**9), 10**9), n)
        rng.shuffle(values)
        yield _case(values)

    n = 10**5
    values = rng.sample(range(-(10**9), 10**9), n)
    rng.shuffle(values)
    yield _case(values, "the stated maximum, where a selection sort cannot finish")
