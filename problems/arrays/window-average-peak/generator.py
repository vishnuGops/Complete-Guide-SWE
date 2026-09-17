"""Random reading series for window-average-peak.

Covers the window sizes where an off-by-one shows up (1, and the whole series),
the tie rule and an all-negative series before going random.
"""

import random
from typing import Any, Dict, Iterator, List


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield {"args": [[4], 1], "name": "single reading"}
    yield {"args": [[1, 2, 3, 4, 5], 5], "name": "window covers everything"}
    yield {"args": [[3, 3, 3, 3], 2], "name": "every window ties"}
    yield {"args": [[-9, -2, -7, -1], 1], "name": "all negative"}
    yield {"args": [[10, -20, 10, -20, 10], 3], "name": "alternating signs"}
    yield {"args": [[0, 0, 0, 1], 2], "name": "best window is last"}
    yield {"args": [[1, 0, 0, 0], 2], "name": "best window is first"}

    for n in (2, 7, 31, 120):
        width = rng.randint(1, n)
        yield {"args": [[rng.randint(-1000, 1000) for _ in range(n)], width]}

    for _ in range(3):
        n = rng.randint(400, 1200)
        yield {"args": [[rng.randint(-(10**6), 10**6) for _ in range(n)], rng.randint(1, n)]}

    big: List[int] = [rng.randint(-1000, 1000) for _ in range(8000)]
    yield {"args": [big, 4000], "name": "maximum size, half-length window"}
