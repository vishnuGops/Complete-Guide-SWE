"""Random inputs for the-lonely-number.

Every row is built to the stated shape - pairs plus one lonely value, shuffled -
so the constraint is true by construction. Negatives and zero appear as the
lonely value, since the sign is what a summing solution gets wrong.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(values: List[int], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [values]}
    if name:
        case["name"] = name
    return case


def _row(rng: random.Random, pairs: int, lonely: int, spread: int) -> List[int]:
    # Drawn one at a time rather than sampled from the whole range: at the
    # stated value bound that range is two billion entries long.
    chosen = set()
    while len(chosen) < pairs:
        value = rng.randint(-spread, spread)
        if value != lonely:
            chosen.add(value)
    others = list(chosen)
    values = others + others + [lonely]
    rng.shuffle(values)
    return values


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([7], "one value")
    yield _case([4, 1, 2, 1, 2], "five values")
    yield _case([-3, 5, 5], "a negative lonely value")
    yield _case([0, 9, 9], "zero is the lonely value")
    yield _case([10**9, -(10**9), -(10**9)], "the extremes of the stated range")

    for pairs, spread in ((1, 10), (3, 20), (10, 50), (40, 200), (200, 1000)):
        yield _case(_row(rng, pairs, rng.randint(-spread, spread), spread))
        yield _case(_row(rng, pairs, 0, spread))

    for _ in range(2):
        pairs = rng.randint(1000, 4000)
        yield _case(_row(rng, pairs, rng.randint(-(10**9), 10**9), 10**9))

    yield _case(_row(rng, (10**5 - 1) // 2, 42, 10**9), "the stated maximum")
