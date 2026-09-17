"""Weather logs for days-until-warmer.

Includes the two shapes that bound the stack - strictly cooling (everything
waits) and strictly warming (nothing waits) - plus plateaus, where the strictness
of the comparison decides the answer.
"""

import random
from typing import Any, Dict, Iterator


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield {"args": [[]], "name": "empty log"}
    yield {"args": [[12]], "name": "one day"}
    yield {"args": [[5, 4, 3, 2, 1]], "name": "strictly cooling, nothing answered"}
    yield {"args": [[1, 2, 3, 4, 5]], "name": "strictly warming, every wait is one"}
    yield {"args": [[7, 7, 7, 8]], "name": "a plateau then a warmer day"}
    yield {"args": [[-100, 100, -100, 100]], "name": "extreme swings"}
    yield {"args": [[3, 1, 4, 1, 5, 9, 2, 6]], "name": "mixed"}

    for n in (4, 15, 60, 200):
        span = rng.choice([3, 20, 100])
        yield {"args": [[rng.randint(-span, span) for _ in range(n)]]}

    for _ in range(3):
        n = rng.randint(400, 1200)
        yield {"args": [[rng.randint(-100, 100) for _ in range(n)]]}

    cooling = sorted((rng.randint(-100, 100) for _ in range(10000)), reverse=True)
    yield {"args": [cooling], "name": "maximum size, never warming"}
