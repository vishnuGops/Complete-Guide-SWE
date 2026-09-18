"""Random inputs for bits-up-to-n.

Powers of two and the values either side of them are covered, since that is where
the bit count resets, along with a spread of random sizes up to the maximum.
"""

import random
from typing import Any, Dict, Iterator


def _case(n: int, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [n]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case(0, "just zero")
    yield _case(1, "up to one")
    yield _case(2, "up to two")
    yield _case(5, "up to five")

    for power in (2, 3, 4, 8, 10, 16):
        yield _case(1 << power)
        yield _case((1 << power) - 1)

    for _ in range(5):
        yield _case(rng.randint(3, 10**5))

    yield _case(99999, "one below the stated maximum")
    yield _case(10**5, "the stated maximum")
