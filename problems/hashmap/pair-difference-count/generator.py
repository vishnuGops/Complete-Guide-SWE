"""Random reading sets for pair-difference-count.

Deliberately mixes narrow value ranges (where pairs are everywhere) with wide
ones (where they are rare), and always includes gap-zero cases.
"""

import random
from typing import Any, Dict, Iterator


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield {"args": [[], 3], "name": "empty list"}
    yield {"args": [[4], 0], "name": "single value, gap zero"}
    yield {"args": [[4, 4], 0], "name": "one repeated value"}
    yield {"args": [[1, 2, 3, 4, 5], 1], "name": "a chain of consecutive values"}
    yield {"args": [[-(10**9), 0, 10**9], 10**9], "name": "extreme values"}
    yield {"args": [[7, 7, 7, 7], 0], "name": "one value many times"}
    yield {"args": [[7, 7, 7, 7], 5], "name": "duplicates but no pair"}

    for n in (3, 10, 50):
        yield {"args": [[rng.randint(-20, 20) for _ in range(n)], rng.randint(0, 5)]}

    for _ in range(3):
        n = rng.randint(200, 800)
        span = rng.choice([30, 500, 10**6])
        yield {"args": [[rng.randint(-span, span) for _ in range(n)], rng.choice([0, 1, 7])]}

    yield {
        "args": [[rng.randint(-5000, 5000) for _ in range(10000)], 3],
        "name": "maximum size",
    }
    yield {
        "args": [[rng.randint(-5000, 5000) for _ in range(4000)], 0],
        "name": "gap zero at scale",
    }
