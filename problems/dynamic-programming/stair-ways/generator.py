"""Random inputs for stair-ways.

One input with forty-six legal values, so every one is covered - which also puts
the hidden pool comfortably above ten once the samples are taken out.
"""

import random
from typing import Any, Dict, Iterator


def _case(n: int, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [n]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case(0, "no steps")
    yield _case(1, "one step")
    yield _case(2, "two steps")
    yield _case(3, "three steps")
    for n in range(4, 45):
        yield _case(n)
    yield _case(45, "the stated maximum, just inside a 32-bit integer")
