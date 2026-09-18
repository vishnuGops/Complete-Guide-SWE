"""Random inputs for generate-brackets.

The input domain is small enough to cover exhaustively for the interesting part
of it: every pair of `n` and `depth` up to six, plus the widest cases at seven
and eight. `depth = 1` and `depth = n` are the two ends where the new prune
either does everything or nothing.
"""

import random
from typing import Any, Dict, Iterator


def _case(n: int, depth: int, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [n, depth]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case(0, 0, "no pairs")
    yield _case(1, 0, "one pair and no depth at all, so nothing is possible")
    yield _case(1, 1, "one pair")
    yield _case(2, 1, "two pairs that may not nest")
    yield _case(2, 2, "two pairs")

    for n in range(3, 7):
        for depth in range(0, n + 1):
            yield _case(n, depth)

    yield _case(7, 1, "seven pairs side by side")
    yield _case(7, 3, "seven pairs, three deep")
    yield _case(7, 7, "seven pairs, unrestricted")
    yield _case(8, 2, "the stated maximum, two deep")
    yield _case(8, 4, "the stated maximum, four deep")
    yield _case(8, 8, "the stated maximum, unrestricted")
