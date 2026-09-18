"""Random inputs for power-of-two-check.

Every power of two in range, the values either side of several of them, zero,
and the most negative value - which is the one case where the bit test alone
says yes and the answer is no.
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
    yield _case(16, "a power of two")
    yield _case(-2147483648, "the most negative value, whose only bit is the sign")
    yield _case(-1, "minus one")
    yield _case(-16, "a negative power of two")
    yield _case(2147483647, "the largest value")

    for power in (1, 2, 3, 5, 10, 20, 30):
        yield _case(1 << power)
        yield _case((1 << power) - 1)
        yield _case((1 << power) + 1)

    for _ in range(6):
        yield _case(rng.randint(-2147483648, 2147483647))
