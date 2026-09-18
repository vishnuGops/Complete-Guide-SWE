"""Random inputs for minimum-spanning-cost.

Half the cases lay down a random spanning tree first so that a connected set
exists, and the rest are sparse random offers that usually leave somebody
stranded. Duplicate pairs at different prices are included on purpose.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(n: int, cables: List[List[int]], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [n, cables]}
    if name:
        case["name"] = name
    return case


def _offers(rng: random.Random, n: int, m: int, high: int, connected: bool) -> List[List[int]]:
    cables: List[List[int]] = []
    if connected and n > 1:
        order = list(range(n))
        rng.shuffle(order)
        for index in range(1, n):
            parent = order[rng.randrange(index)]
            cables.append([parent, order[index], rng.randint(1, high)])
    while len(cables) < m:
        a = rng.randrange(n)
        b = rng.randrange(n)
        if a == b:
            continue
        cables.append([a, b, rng.randint(1, high)])
    rng.shuffle(cables)
    return cables


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case(1, [], "a single machine")
    yield _case(2, [], "two machines, nothing offered")
    yield _case(2, [[0, 1, 7]], "one cable")
    yield _case(3, [[0, 1, 1], [1, 2, 2], [0, 2, 3]], "three machines, three cables offered")
    yield _case(3, [[0, 1, 1]], "a machine that cannot be reached")
    yield _case(2, [[0, 1, 5], [0, 1, 2], [1, 0, 9]], "the same pair offered three times")
    yield _case(4, [[0, 1, 10**4], [1, 2, 10**4], [2, 3, 10**4]], "the extremes of the stated price range")

    for n, m, high in ((4, 6, 10), (10, 20, 50), (40, 120, 100), (150, 500, 1000)):
        yield _case(n, _offers(rng, n, m, high, connected=True))
        yield _case(n, _offers(rng, n, m // 3, high, connected=False))

    # A ring: every cable is needed except the dearest.
    n = 200
    ring = [[i, (i + 1) % n, rng.randint(1, 100)] for i in range(n)]
    yield _case(n, ring, "a ring, where exactly one cable is skipped")

    for _ in range(2):
        n = rng.randint(500, 3000)
        yield _case(n, _offers(rng, n, rng.randint(n, n * 3), 10**4, connected=True))

    n = 10**4
    yield _case(n, _offers(rng, n, 10**5, 10**4, connected=True), "the stated maxima")
    yield _case(n, _offers(rng, n, 10**4, 10**4, connected=False), "the stated maximum, usually unconnectable")
