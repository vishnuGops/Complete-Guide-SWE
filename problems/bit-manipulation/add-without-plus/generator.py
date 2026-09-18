"""Random inputs for add-without-plus.

Sign combinations are covered exhaustively at small magnitudes, and every pair is
checked to keep the sum inside a signed 32-bit integer, as the statement
promises. Values that carry all the way up - a run of ones plus one - are
included because that is where a single-round solution fails.
"""

import random
from typing import Any, Dict, Iterator

LIMIT = 2**31 - 1
FLOOR = -(2**31)


def _case(first: int, second: int, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [first, second]}
    if name:
        case["name"] = name
    return case


def _safe(a: int, b: int) -> bool:
    return FLOOR <= a + b <= LIMIT


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case(0, 0, "both zero")
    yield _case(1, 2, "one and two")
    yield _case(-2, 3, "a negative and a positive")
    yield _case(-5, -7, "both negative")
    yield _case(1, -1, "opposites")
    yield _case(1023, 1, "a run of ones, carried all the way")
    yield _case(10**9, -(10**9), "the extremes of the stated range")
    yield _case(10**9, 10**9 - 1, "two large positives")
    yield _case(-(10**9), -(10**9), "two large negatives")

    for high in (10, 1000, 10**6, 10**9):
        for signs in ((1, 1), (1, -1), (-1, 1), (-1, -1)):
            a = signs[0] * rng.randint(0, high)
            b = signs[1] * rng.randint(0, high)
            if _safe(a, b):
                yield _case(a, b)

    for _ in range(6):
        a = rng.randint(-(10**9), 10**9)
        b = rng.randint(-(10**9), 10**9)
        if _safe(a, b):
            yield _case(a, b)
