"""Random inputs for count-the-ones.

Powers of two, values one below a power of two, and the ends of the range are
covered explicitly - those are the shapes where an off-by-one in the loop shows
up.
"""

import random
from typing import Any, Dict, Iterator


def _case(value: int, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [value]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case(0, "zero")
    yield _case(1, "one")
    yield _case(11, "eleven")
    yield _case(2147483647, "the largest value")
    yield _case(2147483646, "one below the largest")

    for power in (1, 2, 4, 8, 16, 30):
        yield _case(1 << power)
        yield _case((1 << power) - 1)

    for _ in range(8):
        yield _case(rng.randint(0, 2147483647))

    yield _case(1431655765, "alternating bits from the bottom")
    yield _case(1431655764, "the same, one lower")
