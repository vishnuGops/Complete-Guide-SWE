"""Random reading logs for even-odd-partition.

Covers the shapes where a stable partition can go wrong - all one parity, a
single reading, an empty log - before going random.
"""

import random
from typing import Any, Dict, Iterator


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield {"args": [[]], "name": "empty log"}
    yield {"args": [[2]], "name": "single even reading"}
    yield {"args": [[7]], "name": "single odd reading"}
    yield {"args": [[8, 4, 2, 0]], "name": "already all even"}
    yield {"args": [[9, 5, 3, 1]], "name": "already all odd"}
    yield {"args": [[1, 2, 3, 4, 5, 6]], "name": "strictly alternating"}
    yield {"args": [[0, -1, -2, -3, 0]], "name": "zero and negatives"}
    yield {"args": [[6, 6, 5, 5, 6, 5]], "name": "duplicates in both groups"}

    for n in (2, 5, 17, 64):
        yield {"args": [[rng.randint(-50, 50) for _ in range(n)]]}

    for _ in range(3):
        n = rng.randint(200, 900)
        yield {"args": [[rng.randint(-(10**9), 10**9) for _ in range(n)]]}

    yield {
        "args": [[rng.randint(-(10**6), 10**6) for _ in range(5000)]],
        "name": "maximum size",
    }
