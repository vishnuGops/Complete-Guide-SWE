"""Random booking lists for merge-overlapping-windows.

Deliberately produces windows that touch, windows fully contained in others and
windows that share nothing, since those are the three branches of the sweep.
"""

import random
from typing import Any, Dict, Iterator, List


def _windows(rng: random.Random, n: int, span: int, width: int) -> List[List[int]]:
    out: List[List[int]] = []
    for _ in range(n):
        start = rng.randint(-span, span)
        out.append([start, start + rng.randint(0, width)])
    rng.shuffle(out)
    return out


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield {"args": [[]], "name": "nothing booked"}
    yield {"args": [[[5, 5]]], "name": "a single instant"}
    yield {"args": [[[1, 9], [2, 3]]], "name": "one window inside another"}
    yield {"args": [[[4, 5], [1, 4]]], "name": "touching, given out of order"}
    yield {"args": [[[1, 2], [3, 4], [5, 6]]], "name": "nothing overlaps"}
    yield {"args": [[[1, 2], [1, 2], [1, 2]]], "name": "identical windows"}
    yield {"args": [[[-(10**9), 0], [0, 10**9]]], "name": "extreme bounds that touch"}

    for n, span, width in ((3, 10, 3), (12, 40, 6), (60, 200, 20)):
        yield {"args": [_windows(rng, n, span, width)]}

    for _ in range(3):
        n = rng.randint(200, 800)
        yield {"args": [_windows(rng, n, rng.choice([100, 10**5]), rng.choice([5, 500]))]}

    yield {"args": [_windows(rng, 6000, 10**6, 200)], "name": "maximum size"}
