"""Random inputs for split-into-k-parts.

The shapes that matter: k = 1 (the answer is the total), k = n (the answer is
the largest job), one enormous job among small ones (the largest job decides
whatever k is), all-zero loads, and a maximum-size queue where filling a table
over positions and workers cannot finish.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(loads: List[int], k: int, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [loads, k]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([5], 1, "one job, one worker")
    yield _case([5, 1, 7, 3, 6], 1, "one worker takes everything")
    yield _case([1, 2, 3, 4, 5], 5, "one job each")
    yield _case([0, 0, 0, 0], 2, "every job is empty")
    yield _case([10**6, 1, 1], 2, "one enormous job among small ones")
    yield _case([1, 1, 1, 1, 1, 1], 4, "equal jobs that do not divide evenly")

    for n in (6, 20, 80, 300):
        loads = [rng.randint(0, 100) for _ in range(n)]
        yield _case(loads, rng.randint(1, n))

    for _ in range(3):
        n = rng.randint(500, 2000)
        loads = [rng.randint(0, 10**6) for _ in range(n)]
        yield _case(loads, rng.randint(2, min(n, 50)))

    # The stated maximum, at the stated load values, with k in the middle -
    # where a table over (position, workers) cannot finish.
    n = 10**4
    yield _case(
        [rng.randint(0, 10**6) for _ in range(n)],
        n // 3,
        "the stated maximum, where a table over positions and workers cannot finish",
    )
