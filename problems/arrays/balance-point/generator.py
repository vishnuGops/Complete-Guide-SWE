"""Random weight rows for balance-point.

Some cases are built to balance somewhere on purpose: a generator that only
produced random rows would almost always answer -1 and exercise one branch.
"""

import random
from typing import Any, Dict, Iterator, List


def _balanced(rng: random.Random, n: int, lo: int, hi: int) -> List[int]:
    """`n` weights in [lo, hi] that balance at index (n - 1) // 2."""
    left = [rng.randint(lo, hi) for _ in range((n - 1) // 2)]
    right = [rng.randint(lo, hi) for _ in range(n - 1 - len(left))]
    # Spread the difference over the right-hand side rather than dumping it on
    # one element, which used to push a weight far outside the stated range.
    diff = sum(left) - sum(right)
    for i in range(len(right)):
        step = max(lo - right[i], min(hi - right[i], diff))
        right[i] += step
        diff -= step
    for i in range(len(left)):
        step = max(lo - left[i], min(hi - left[i], -diff))
        left[i] += step
        diff += step
    assert diff == 0
    return left + [rng.randint(lo, hi)] + right


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield {"args": [[]], "name": "empty row"}
    yield {"args": [[5]], "name": "single position always balances"}
    yield {"args": [[1, 1]], "name": "two positions, no balance"}
    yield {"args": [[0, 0, 0]], "name": "every index balances, smallest wins"}
    yield {"args": [[-1, 2, -1]], "name": "negatives on both sides"}
    yield {"args": [[3, -3, 0]], "name": "balances at the last index"}
    yield {"args": [[10, 0, 10]], "name": "balances in the middle"}

    for n in (2, 6, 25, 90):
        yield {"args": [[rng.randint(-40, 40) for _ in range(n)]]}

    for _ in range(3):
        yield {"args": [_balanced(rng, rng.randint(7, 121), -1000, 1000)]}

    for _ in range(2):
        n = rng.randint(500, 1500)
        yield {"args": [[rng.randint(-(10**6), 10**6) for _ in range(n)]]}

    yield {"args": [_balanced(rng, 4001, -1000, 1000)], "name": "large row that balances"}

    # The stated maximum (D21, P6-0): the statement allows 10^4 and the largest
    # case here used to be 4001, so nothing tested what the constraint claims.
    yield {
        "args": [_balanced(rng, 10**4, -(10**6), 10**6)],
        "name": "the stated maximum, balancing",
    }
