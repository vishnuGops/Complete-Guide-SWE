"""Random inputs for peak-reading.

Every row is built to the stated shape: a strictly rising run, a peak, then a
strictly falling run. The interesting variation is where the peak sits - at the
second position, at the second-to-last, and everywhere between - because that is
what a search biased to one side gets wrong.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(values: List[int], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [values]}
    if name:
        case["name"] = name
    return case


def _climb(rng: random.Random, up: int, down: int, base: int = 0, step: int = 3) -> List[int]:
    """A row that rises for `up` steps and falls for `down`, peak in between."""
    values = [base]
    for _ in range(up):
        values.append(values[-1] + rng.randint(1, step))
    for _ in range(down):
        values.append(values[-1] - rng.randint(1, step))
    return values


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([0, 10, 9], "the shortest climb log")
    yield _case([1, 2, 3, 4, 3], "the peak next to the end")
    yield _case([1, 5, 4, 3, 2], "the peak next to the start")
    yield _case([-5, -4, -3, -9], "negative readings")
    yield _case([-(10**9), 0, 10**9 - 1, 10**9, 0], "the extremes of the stated range")

    for up, down in ((1, 5), (5, 1), (8, 8), (30, 3), (3, 30)):
        yield _case(_climb(rng, up, down, base=rng.randint(-1000, 1000)))

    for _ in range(3):
        up = rng.randint(1, 400)
        down = rng.randint(1, 400)
        yield _case(_climb(rng, up, down, base=rng.randint(-(10**6), 10**6)))

    # The stated maximum, with the peak very near the start so that a search
    # that leans right has to walk all the way back.
    n = 10**5
    yield _case(_climb(rng, 1, n - 2, base=0, step=9), "the stated maximum, peak at position 1")
