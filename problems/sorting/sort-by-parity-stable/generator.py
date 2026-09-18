"""Random inputs for sort-by-parity-stable.

Negative odd readings are the point: `% 2 == 1` is false for them in Java, so
any row containing one separates a correct classification from a plausible one.
The rest cover all-even, all-odd and single readings.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(values: List[int], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [values]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([0], "zero is even")
    yield _case([-7], "a single negative odd reading")
    yield _case([-1, -2, -3, -4], "negatives of both parities")
    yield _case([2, 4, 6, 8], "everything even")
    yield _case([1, 3, 5, 7], "everything odd")
    yield _case([-(10**9), 10**9], "the extremes of the stated range, both odd")

    for n in (3, 9, 30, 100):
        yield _case([rng.randint(-50, 50) for _ in range(n)])

    # Heavily negative, so a wrong parity test shows up immediately.
    yield _case([rng.randint(-1000, -1) for _ in range(200)], "all negative")

    for _ in range(2):
        n = rng.randint(300, 900)
        yield _case([rng.randint(-(10**9), 10**9) for _ in range(n)])

    yield _case(
        [rng.randint(-(10**9), 10**9) for _ in range(10**4)],
        "the stated maximum",
    )
