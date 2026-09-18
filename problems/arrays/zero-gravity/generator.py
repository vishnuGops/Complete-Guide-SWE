"""Random inputs for zero-gravity.

The interesting shapes are the ones where the write position lags the read
position by a different amount: no zeroes at all, nothing but zeroes, zeroes
only at the front, and zeroes only at the back.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(values: List[int], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [values]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([1], "a single non-zero value")
    yield _case([0], "a single zero")
    yield _case([1, 2, 3], "nothing to move")
    yield _case([0, 0, 1], "the zeroes are already at the front")
    yield _case([1, 0, 0], "the zeroes are already at the back")
    yield _case([0, -1, 0, -2, 0], "negatives interleaved with zeroes")

    for n in (2, 5, 16, 64):
        yield _case([rng.choice([0, rng.randint(-50, 50)]) for _ in range(n)])

    for _ in range(3):
        n = rng.randint(100, 500)
        # A third zeroes, so the write position lags by a growing amount.
        yield _case([0 if rng.random() < 0.33 else rng.randint(-(10**9), 10**9) for _ in range(n)])

    yield _case(
        [0 if rng.random() < 0.5 else rng.randint(-(10**9), 10**9) for _ in range(10**4)],
        "the stated maximum, half of it zeroes",
    )
