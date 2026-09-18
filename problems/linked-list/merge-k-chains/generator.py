"""Random operation inputs for merge-k-chains.

Each case is a list of ascending chains. The shapes that matter: no chains at
all, chains that are all empty, one chain holding everything, and ten thousand
chains of a single link - which is where folding them in one at a time cannot
finish.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(chains: List[List[int]], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [chains]}
    if name:
        case["name"] = name
    return case


def _chains(rng: random.Random, k: int, total: int, spread: int) -> List[List[int]]:
    """`k` ascending chains holding `total` values between them."""
    values = [rng.randint(-spread, spread) for _ in range(total)]
    buckets: List[List[int]] = [[] for _ in range(k)]
    for value in values:
        buckets[rng.randrange(k)].append(value)
    return [sorted(bucket) for bucket in buckets]


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([], "no chains at all")
    yield _case([[]], "one empty chain")
    yield _case([[], [], []], "every chain empty")
    yield _case([[1]], "one chain of one link")
    yield _case([[], [1], []], "empty chains among the rest")
    yield _case([[-(10**9)], [10**9]], "the extremes of the stated range")
    yield _case([[1, 2, 3, 4, 5]], "one chain holding everything")

    for k, total in ((2, 8), (4, 20), (9, 60), (30, 200)):
        yield _case(_chains(rng, k, total, 50))

    yield _case([[5] for _ in range(200)], "two hundred chains of the same single value")

    for _ in range(2):
        k = rng.randint(50, 400)
        yield _case(_chains(rng, k, rng.randint(500, 2000), 10**9))

    # The stated maxima in the shape that defeats folding them in one at a time.
    yield _case(
        [[rng.randint(-(10**9), 10**9)] for _ in range(10**4)],
        "ten thousand chains of one link, where folding one at a time cannot finish",
    )
