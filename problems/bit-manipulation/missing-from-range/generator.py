"""Random inputs for missing-from-range.

Every row is a shuffled `0..n` with one number removed, so the statement holds by
construction. Both ends are removed explicitly - zero and n itself - since those
are the two cases a solution tends to miss.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(values: List[int], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [values]}
    if name:
        case["name"] = name
    return case


def _row(rng: random.Random, n: int, missing: int, shuffle: bool = True) -> List[int]:
    values = [v for v in range(n + 1) if v != missing]
    if shuffle:
        rng.shuffle(values)
    return values


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([0], "the top is missing")
    yield _case([1], "zero is missing")
    yield _case([3, 0, 1], "three of four")
    yield _case([0, 1, 2], "the top of four is missing, already in order")

    for n in (3, 5, 10, 50, 300):
        yield _case(_row(rng, n, 0))
        yield _case(_row(rng, n, n))
        yield _case(_row(rng, n, rng.randint(0, n)))
        yield _case(_row(rng, n, rng.randint(0, n), shuffle=False))

    for _ in range(2):
        n = rng.randint(2000, 8000)
        yield _case(_row(rng, n, rng.randint(0, n)))

    n = 10**5
    yield _case(_row(rng, n, rng.randint(0, n)), "the stated maximum")
    yield _case(_row(rng, n, n), "the stated maximum, missing the top")
