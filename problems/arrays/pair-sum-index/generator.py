"""Random inputs for pair-sum-index.

Every generated case is checked to have exactly one valid pair before it is
yielded, because the statement promises that and both references rely on it.
"""

import random
from typing import Any, Dict, Iterator, List


def _pair_count(values: List[int], target: int) -> int:
    count = 0
    for i in range(len(values)):
        for j in range(i + 1, len(values)):
            if values[i] + values[j] == target:
                count += 1
    return count


def _unique_case(rng: random.Random, n: int, lo: int, hi: int) -> Dict[str, Any]:
    while True:
        values = [rng.randint(lo, hi) for _ in range(n)]
        i, j = rng.sample(range(n), 2)
        target = values[i] + values[j]
        if _pair_count(values, target) == 1:
            return {"args": [values, target]}


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield {"args": [[4, 9], 13], "name": "smallest possible input"}
    yield {"args": [[-8, -3, 5, 11], -11], "name": "negative values"}
    yield {"args": [[7, 7, 2], 14], "name": "the pair is a repeated value"}
    yield {"args": [[0, 0, 3], 0], "name": "zeros pair with each other"}
    yield {"args": [[10, 1, 2, 3, 4], 14], "name": "answer spans the whole array"}

    for n in (2, 3, 5, 12, 40):
        yield _unique_case(rng, n, -50, 50)
    for _ in range(4):
        yield _unique_case(rng, rng.randint(50, 200), -10**6, 10**6)
    yield _unique_case(rng, 1000, -10**9, 10**9)
