"""Random logs for frequency-order.

Narrow value ranges force ties, which is where the tie-breaking rule is actually
tested; wide ranges make almost every value unique.
"""

import random
from typing import Any, Dict, Iterator


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield {"args": [[]], "name": "empty log"}
    yield {"args": [[9]], "name": "one entry"}
    yield {"args": [[2, 2, 2, 2]], "name": "one value repeated"}
    yield {"args": [[3, 1, 2]], "name": "every count ties at one"}
    yield {"args": [[-1, -1, 0, 0, 1, 1]], "name": "ties across negatives and zero"}
    yield {"args": [[10**9, 10**9, -(10**9)]], "name": "extreme values"}

    for n, span in ((5, 3), (25, 6), (100, 15)):
        yield {"args": [[rng.randint(-span, span) for _ in range(n)]]}

    for _ in range(3):
        n = rng.randint(300, 900)
        span = rng.choice([10, 1000, 10**9])
        yield {"args": [[rng.randint(-span, span) for _ in range(n)]]}

    yield {"args": [[rng.randint(-60, 60) for _ in range(10000)]], "name": "maximum size, many ties"}
