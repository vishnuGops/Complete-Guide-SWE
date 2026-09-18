"""Random inputs for product-except-self.

Every row obeys the stated bound of at most twelve readings with an absolute
value of 2 or more, so prefix and suffix products stay well inside 64 bits. The
shapes that matter are the zeroes: none, exactly one (only its own position is
non-zero) and two or more (every answer is zero).
"""

import random
from typing import Any, Dict, Iterator, List

BIG = [-9, -8, -7, -6, -5, -4, -3, -2, 2, 3, 4, 5, 6, 7, 8, 9]


def _case(values: List[int], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [values]}
    if name:
        case["name"] = name
    return case


def _row(rng: random.Random, n: int, big: int, zeroes: int = 0) -> List[int]:
    """A row of +-1 with `big` larger readings and `zeroes` zeroes sprinkled in."""
    values = [rng.choice([-1, 1]) for _ in range(n)]
    positions = rng.sample(range(n), min(big + zeroes, n))
    for index in positions[:big]:
        values[index] = rng.choice(BIG)
    for index in positions[big:]:
        values[index] = 0
    return values


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([1, 1], "the shortest row, with nothing to multiply")
    yield _case([9, -9], "the extremes of the stated value range")
    yield _case([0, 0], "two zeroes, so every answer is zero")
    yield _case([3, 0, 2, 5], "exactly one zero")
    yield _case([0, 1, 0, 1], "two zeroes among ones")
    yield _case([-1, -1, -1], "the sign is the whole answer")

    for n in (3, 8, 30, 100):
        yield _case(_row(rng, n, big=rng.randint(0, 4)))

    yield _case(_row(rng, 200, big=12), "the stated maximum number of large readings")
    yield _case(_row(rng, 500, big=6, zeroes=1), "one zero in a long row")
    yield _case(_row(rng, 500, big=6, zeroes=3), "several zeroes in a long row")

    yield _case(
        _row(rng, 10**4, big=12),
        "the stated maximum, where a product per position cannot finish",
    )
