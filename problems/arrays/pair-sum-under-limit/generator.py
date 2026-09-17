"""Random sorted parcel queues for pair-sum-under-limit.

The limit is chosen relative to the weights present, so cases land on all three
outcomes: nothing fits, everything fits, and somewhere in between.
"""

import random
from typing import Any, Dict, Iterator, List


def _queue(rng: random.Random, n: int, lo: int, hi: int) -> List[int]:
    return sorted(rng.randint(lo, hi) for _ in range(n))


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield {"args": [[], 5], "name": "empty queue"}
    yield {"args": [[1], 5], "name": "a single parcel has no pair"}
    yield {"args": [[1, 2], 3], "name": "the only pair fits exactly"}
    yield {"args": [[1, 2], 2], "name": "the only pair is over the limit"}
    yield {"args": [[2, 2, 2, 2], 4], "name": "every parcel identical, all pairs fit"}
    yield {"args": [[-10**4, -10**4, 10**4, 10**4], 0], "name": "extreme weights"}
    yield {"args": [[0, 0, 0], -1], "name": "negative limit excludes everything"}

    for n in (3, 9, 40, 150):
        queue = _queue(rng, n, -100, 100)
        yield {"args": [queue, rng.randint(-200, 200)]}

    for _ in range(3):
        n = rng.randint(400, 1200)
        queue = _queue(rng, n, -(10**4), 10**4)
        yield {"args": [queue, rng.choice([-(10**9), 0, rng.randint(-2000, 2000), 10**9])]}

    big = _queue(rng, 10000, -(10**4), 10**4)
    yield {"args": [big, 0], "name": "maximum size"}
