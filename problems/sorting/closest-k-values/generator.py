"""Random inputs for closest-k-values.

Sorted rows with duplicates, and targets drawn from inside the row, outside it
on both sides, and exactly on a boundary - the last of which is where the tie
rule decides the answer.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(readings: List[int], k: int, target: int, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [readings, k, target]}
    if name:
        case["name"] = name
    return case


def _sorted_row(rng: random.Random, n: int, spread: int) -> List[int]:
    return sorted(rng.randint(-spread, spread) for _ in range(n))


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([5], 1, 5, "a single reading, exactly on target")
    yield _case([1, 2, 3, 4, 5], 5, 3, "every reading wanted")
    yield _case([1, 2, 3, 4, 5], 1, 3, "one reading wanted, exactly on target")
    yield _case([1, 5], 1, 3, "an exact tie, broken towards the smaller")
    yield _case([-(10**9), 10**9], 1, 0, "the extremes of the stated range")
    yield _case([2, 2, 2, 2], 2, 2, "every reading the same")
    yield _case([10, 20, 30], 2, 100, "the target sits above everything")

    for n, spread in ((6, 20), (25, 60), (80, 200), (300, 50)):
        row = _sorted_row(rng, n, spread)
        yield _case(row, rng.randint(1, n), rng.randint(-spread - 10, spread + 10))

    # Targets landing exactly halfway between two readings.
    row = sorted(rng.sample(range(0, 2000, 2), 100))
    yield _case(row, 4, row[50] + 1, "a target halfway between two readings")

    for _ in range(2):
        n = rng.randint(500, 2000)
        row = _sorted_row(rng, n, 10**9)
        yield _case(row, rng.randint(1, n), rng.randint(-(10**9), 10**9))

    n = 10**4
    row = _sorted_row(rng, n, 10**9)
    yield _case(row, n // 3, rng.randint(-(10**9), 10**9), "the stated maximum")
