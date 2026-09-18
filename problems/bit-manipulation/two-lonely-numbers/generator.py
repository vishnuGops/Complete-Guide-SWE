"""Random inputs for two-lonely-numbers.

Every row is built to the stated shape. Pairs of lonely values that differ only
in a high bit are included on purpose, since a solution that assumes the lowest
bit differs gets those wrong.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(values: List[int], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [values]}
    if name:
        case["name"] = name
    return case


def _row(rng: random.Random, pairs: int, first: int, second: int, spread: int) -> List[int]:
    chosen = set()
    while len(chosen) < pairs:
        value = rng.randint(-spread, spread)
        if value not in (first, second):
            chosen.add(value)
    others = list(chosen)
    values = others * 2 + [first, second]
    rng.shuffle(values)
    return values


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([-1, 0], "just the two")
    yield _case([1, 2, 1, 3, 2, 5], "six values")
    yield _case([9, 9, 4, 7], "one pair and two singles")
    yield _case([0, 1], "zero and one")
    yield _case([-(10**9), 10**9], "the extremes of the stated range")
    yield _case([8, 8, 1024, 2048], "two values differing only in a high bit")
    yield _case([5, 5, 6, 6, -7, -8], "two negatives among pairs")

    for pairs, spread in ((0, 10), (1, 20), (5, 100), (30, 1000), (200, 10**6)):
        a = rng.randint(-spread, spread)
        b = a
        while b == a:
            b = rng.randint(-spread, spread)
        yield _case(_row(rng, pairs, a, b, spread))

    # Lonely values that agree in every low bit.
    yield _case(_row(rng, 50, 1 << 20, 1 << 21, 10**6), "two lonely powers of two")

    for _ in range(2):
        pairs = rng.randint(1000, 4000)
        a = rng.randint(-(10**9), 10**9)
        b = a
        while b == a:
            b = rng.randint(-(10**9), 10**9)
        yield _case(_row(rng, pairs, a, b, 10**9))

    yield _case(_row(rng, (10**5 - 2) // 2, -42, 99, 10**9), "the stated maximum")
