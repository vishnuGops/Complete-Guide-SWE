"""Rotated series for rotated-lookup.

Every case is built by choosing distinct values, sorting them and rotating by a
random amount, so the input always satisfies the statement. Targets are drawn
both from inside the series and from outside it.
"""

import random
from typing import Any, Dict, Iterator, List


def _rotated(rng: random.Random, n: int, span: int) -> List[int]:
    values = sorted(rng.sample(range(-span, span), n))
    shift = rng.randrange(n) if n else 0
    return values[shift:] + values[:shift]


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield {"args": [[], 1], "name": "empty series"}
    yield {"args": [[4], 4], "name": "single reading, present"}
    yield {"args": [[4], 5], "name": "single reading, absent"}
    yield {"args": [[1, 2, 3, 4, 5], 1], "name": "not rotated at all"}
    yield {"args": [[2, 1], 1], "name": "two readings, rotated"}
    yield {"args": [[5, 1, 2, 3, 4], 5], "name": "target at the rotation point"}
    yield {"args": [[3, 4, 5, 1, 2], 2], "name": "target at the very end"}

    for n in (3, 8, 40, 150):
        series = _rotated(rng, n, 500)
        target = rng.choice(series) if rng.random() < 0.7 else rng.randint(-600, 600)
        yield {"args": [series, target]}

    for _ in range(4):
        n = rng.randint(400, 1500)
        series = _rotated(rng, n, 10**6)
        target = rng.choice(series) if rng.random() < 0.6 else rng.randint(-(10**6), 10**6)
        yield {"args": [series, target]}

    big = _rotated(rng, 2000, 10**9)
    yield {"args": [big, big[len(big) // 5]], "name": "maximum size, present"}
    yield {"args": [big, 10**9 + 1], "name": "maximum size, absent"}
