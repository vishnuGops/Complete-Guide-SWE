"""Random inputs for n-queens-count.

There is one input and thirteen legal values, so every one is covered exactly
once - which is also what keeps the hidden pool above the ten every problem
needs, once the three samples are taken out of it. The interesting ones are 2 and 3, which have no placement at all, and the
top of the range, where an unpruned search does not finish.
"""

import random
from typing import Any, Dict, Iterator


def _case(n: int, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [n]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case(1, "one queen")
    yield _case(2, "two queens, which cannot be placed")
    yield _case(3, "no placement exists")
    yield _case(4, "the four by four board")
    yield _case(5, "ten placements")
    yield _case(6, "four placements")
    yield _case(7, "forty placements")
    yield _case(8, "the classic board")
    yield _case(9, "three hundred and fifty-two")
    yield _case(10, "seven hundred and twenty-four")
    yield _case(11, "two thousand six hundred and eighty")
    yield _case(12, "fourteen thousand two hundred")
    yield _case(13, "the stated maximum, where an unpruned search cannot finish")
