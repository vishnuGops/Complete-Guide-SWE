"""Random inputs for sort-three-colours.

The shapes that catch the classic bug - advancing past a value swapped in from
the back - are rows ending in 2s with 0s hidden behind them. The rest cover the
degenerate cases: one grade only, two grades only, already sorted, reversed.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(values: List[int], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [values]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([0], "a single low")
    yield _case([2], "a single high")
    yield _case([2, 0], "the smallest swap")
    yield _case([2, 2, 0, 0], "every high before every low")
    yield _case([0, 1, 2], "already in order")
    yield _case([2, 1, 0], "exactly reversed")
    yield _case([1, 2, 0, 2, 0], "zeroes hidden behind the highs")

    for n in (5, 12, 40, 150):
        yield _case([rng.randint(0, 2) for _ in range(n)])

    for kinds in ([0, 1], [1, 2], [0, 2]):
        yield _case([rng.choice(kinds) for _ in range(60)])

    for _ in range(2):
        n = rng.randint(300, 900)
        yield _case([rng.choices([0, 1, 2], weights=[1, 6, 1])[0] for _ in range(n)])

    yield _case(
        [rng.randint(0, 2) for _ in range(10**4)],
        "the stated maximum",
    )
