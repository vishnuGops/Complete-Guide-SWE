import random
from typing import Any, Dict, Iterator, List


def _weighted(rng: random.Random, n: int, m: int, high: int, connected: bool = False) -> List[List[int]]:
    """`m` distinct weighted one-way roads over `n` places.

    With `connected`, a random spanning chain is laid down first so that every
    place is reachable from place 0 - otherwise a sparse random graph almost
    always leaves somebody stranded and every case answers -1.
    """
    seen = set()
    roads: List[List[int]] = []

    if connected and n > 1:
        order = list(range(1, n))
        rng.shuffle(order)
        reached = [0]
        for place in order:
            source = rng.choice(reached)
            seen.add((source, place))
            roads.append([source, place, rng.randint(1, high)])
            reached.append(place)

    attempts = 0
    while len(roads) < m and attempts < m * 8:
        attempts += 1
        u = rng.randrange(n)
        v = rng.randrange(n)
        if u == v or (u, v) in seen:
            continue
        seen.add((u, v))
        roads.append([u, v, rng.randint(1, high)])
    return roads


def _case(n: int, links: List[List[int]], source: int, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [n, links, source]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case(1, [], 0, "one machine")
    yield _case(2, [], 0, "a machine that never hears")
    yield _case(2, [[0, 1, 5]], 0, "one link")
    yield _case(2, [[0, 1, 5]], 1, "the source is the far end")
    yield _case(4, [[0, 1, 1], [0, 2, 4], [1, 2, 1], [2, 3, 1]], 0, "the indirect route is faster")
    yield _case(3, [[0, 1, 10**4], [1, 2, 10**4]], 0, "the extremes of the stated delay range")

    for n, m, high in ((5, 8, 10), (12, 25, 50), (40, 110, 100), (150, 500, 1000)):
        yield _case(n, _weighted(rng, n, m, high, connected=True), 0)
        yield _case(n, _weighted(rng, n, m, high), rng.randrange(n))

    # A chain, so the answer is the whole length.
    n = 300
    yield _case(n, [[i, i + 1, rng.randint(1, 9)] for i in range(n - 1)], 0, "a chain of three hundred")

    # Connected from 0 but asked from somewhere else, so usually -1.
    n = 80
    yield _case(n, _weighted(rng, n, 200, 50, connected=True), n - 1, "broadcast from the wrong end")

    for _ in range(2):
        n = rng.randint(500, 3000)
        yield _case(n, _weighted(rng, n, rng.randint(n, n * 3), 10**4, connected=True), 0)

    n = 10**4
    yield _case(n, _weighted(rng, n, 5 * 10**4, 10**4, connected=True), 0,
                "the stated maxima, where relaxing every link n times cannot finish")
