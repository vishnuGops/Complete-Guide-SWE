"""Random reading series for longest-distinct-stretch.

Mixes narrow alphabets (where the window rarely shrinks) with wide ones (where it
shrinks constantly), because those exercise opposite halves of the loop.
"""

import random
from typing import Any, Dict, Iterator


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield {"args": [[7], 1], "name": "single reading"}
    yield {"args": [[1, 1, 1, 1], 1], "name": "one value throughout"}
    yield {"args": [[1, 2, 3, 4], 1], "name": "every neighbour differs, limit one"}
    yield {"args": [[1, 2, 3, 4], 9], "name": "limit larger than the alphabet"}
    yield {"args": [[1, 2, 1, 2, 3, 1, 2], 2], "name": "window shrinks then regrows"}
    yield {"args": [[0, 0, 1, 1, 2, 2, 3, 3], 2], "name": "runs of pairs"}
    yield {"args": [[10**9, 0, 10**9, 0], 2], "name": "extreme values"}

    for n in (5, 20, 60):
        alphabet = rng.randint(1, 6)
        yield {"args": [[rng.randint(0, alphabet) for _ in range(n)], rng.randint(1, 4)]}

    for _ in range(3):
        n = rng.randint(300, 900)
        alphabet = rng.choice([3, 25, 200])
        yield {"args": [[rng.randint(0, alphabet) for _ in range(n)], rng.randint(1, 12)]}

    yield {
        "args": [[rng.randint(0, 40) for _ in range(10000)], 7],
        "name": "maximum size, narrow alphabet",
    }
