"""Random belts for min-load-capacity.

Day budgets are drawn across the whole legal range, because the answer is pinned
to max(weights) when days is large and to sum(weights) when days is one.
"""

import random
from typing import Any, Dict, Iterator, List


def _belt(rng: random.Random, n: int, hi: int) -> List[int]:
    return [rng.randint(1, hi) for _ in range(n)]


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield {"args": [[1], 1], "name": "one parcel, one day"}
    yield {"args": [[10000], 1], "name": "one heavy parcel"}
    yield {"args": [[1, 1, 1, 1], 4], "name": "a day per parcel"}
    yield {"args": [[1, 1, 1, 1], 1], "name": "everything in one day"}
    yield {"args": [[5, 1, 1, 1, 5], 2], "name": "heavy parcels at both ends"}
    yield {"args": [[10000, 1, 10000], 2], "name": "the heaviest parcel dominates"}
    yield {"args": [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5], "name": "increasing weights"}

    for n in (3, 12, 50, 200):
        belt = _belt(rng, n, rng.choice([10, 1000]))
        yield {"args": [belt, rng.randint(1, n)]}

    for _ in range(3):
        n = rng.randint(400, 1500)
        belt = _belt(rng, n, 10000)
        yield {"args": [belt, rng.randint(1, n)]}

    big = _belt(rng, 4000, 10000)
    yield {"args": [big, 37], "name": "maximum size, few days"}
    yield {"args": [big, 3800], "name": "maximum size, many days"}
