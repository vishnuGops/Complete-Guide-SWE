"""Random inputs for largest-joined-number.

Random large numbers rarely share prefixes, and shared prefixes are where the
ordering rule earns its keep - so most cases draw from small pools of digits
where 3, 30 and 34 style collisions happen constantly.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(parts: List[int], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [parts]}
    if name:
        case["name"] = name
    return case


def _prefixy(rng: random.Random, n: int) -> List[int]:
    """Numbers built from a two-digit alphabet, so prefixes collide often."""
    out = []
    for _ in range(n):
        digits = "".join(rng.choice("39") for _ in range(rng.randint(1, 4)))
        out.append(int(digits))
    return out


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([0], "a single zero")
    yield _case([0, 0, 0], "every part is zero")
    yield _case([10, 2], "the two-part case")
    yield _case([3, 30, 34, 5, 9], "prefixes that collide")
    yield _case([10**9, 10**9], "the extreme of the stated range, twice")
    yield _case([1, 0], "a zero that is not the whole answer")
    yield _case([432, 43243], "one part a prefix of the other")

    for n in (3, 7, 20, 60):
        yield _case(_prefixy(rng, n))
        yield _case([rng.randint(0, 10**9) for _ in range(n)])

    yield _case([rng.choice([1, 11, 111]) for _ in range(40)], "repeated digits only")

    yield _case(_prefixy(rng, 200), "the stated maximum, with colliding prefixes")
    yield _case([rng.randint(0, 10**9) for _ in range(200)], "the stated maximum, at the stated values")
