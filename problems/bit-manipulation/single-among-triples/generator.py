"""Random inputs for single-among-triples.

Every row is built to the stated shape - triples plus one lonely value, shuffled.
Negative values and the most negative value itself appear as the lonely one,
because the sign bit is what separates a solution that works in both languages
from one that works in Java only.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(values: List[int], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [values]}
    if name:
        case["name"] = name
    return case


def _row(rng: random.Random, triples: int, lonely: int, spread: int) -> List[int]:
    chosen = set()
    while len(chosen) < triples:
        value = rng.randint(-spread, spread)
        if value != lonely:
            chosen.add(value)
    others = list(chosen)
    values = others * 3 + [lonely]
    rng.shuffle(values)
    return values


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([7], "one value")
    yield _case([2, 2, 3, 2], "four values")
    yield _case([0, 1, 0, 1, 0, 1, 99], "two triples and a single")
    yield _case([-2, -2, 1, -2], "negative triples")
    yield _case([5, 5, 5, -1], "a lonely minus one, every bit set")
    yield _case([1, 1, 1, -(2**31)], "the most negative value, alone")
    yield _case([-(2**31), -(2**31), -(2**31), 2**31 - 1], "both extremes of the stated range")
    yield _case([3, 3, 3, 0], "zero is the lonely value")

    for triples, spread in ((1, 10), (3, 50), (12, 500), (60, 10**6)):
        yield _case(_row(rng, triples, rng.randint(-spread, spread), spread))
        yield _case(_row(rng, triples, -rng.randint(1, spread), spread))

    for _ in range(2):
        triples = rng.randint(1000, 3000)
        yield _case(_row(rng, triples, rng.randint(-(2**31), 2**31 - 1), 2**31 - 1))

    yield _case(_row(rng, (3 * 10**4 - 1) // 3, -12345, 2**31 - 1), "the stated maximum")
