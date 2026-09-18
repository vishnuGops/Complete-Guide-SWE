"""Random inputs for square-root-floor.

Perfect squares and the values immediately either side of them are where a
floating-point answer goes wrong, so they make up most of the cases, together
with the ends of the stated range.
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
    yield _case(2, "the first value that rounds down")
    yield _case(3, "still one")
    yield _case(4, "the first perfect square above one")
    yield _case(2147483647, "the stated maximum")
    yield _case(2147395600, "the largest perfect square in range")
    yield _case(2147395599, "one below the largest perfect square")
    yield _case(2147395601, "one above the largest perfect square")

    for _ in range(6):
        root = rng.randint(2, 46340)
        square = root * root
        yield _case(square)
        yield _case(square - 1)
        yield _case(square + 1)

    for _ in range(4):
        yield _case(rng.randint(0, 2147483647))
