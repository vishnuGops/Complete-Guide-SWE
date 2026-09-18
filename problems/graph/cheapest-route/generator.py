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


def _case(n: int, roads: List[List[int]], start: int, finish: int, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [n, roads, start, finish]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case(1, [], 0, 0, "already there")
    yield _case(2, [], 0, 1, "no roads at all")
    yield _case(2, [[1, 0, 4]], 0, 1, "the road runs the other way")
    yield _case(2, [[0, 1, 4]], 0, 1, "one road")
    yield _case(4, [[0, 1, 1], [1, 2, 1], [0, 2, 5], [2, 3, 1]], 0, 3, "two short roads beat one long one")
    yield _case(3, [[0, 1, 10**4], [1, 2, 10**4]], 0, 2, "the extremes of the stated toll range")
    yield _case(3, [[0, 1, 1], [1, 2, 1], [0, 2, 1]], 0, 2, "a shortcut that ties on road count")

    for n, m, high in ((5, 6, 10), (12, 20, 50), (40, 90, 100), (150, 400, 1000)):
        roads = _weighted(rng, n, m, high, connected=True)
        yield _case(n, roads, 0, n - 1)
        yield _case(n, roads, rng.randrange(n), rng.randrange(n))
        yield _case(n, _weighted(rng, n, m, high), 0, n - 1)

    # A long chain where every road is cheap, beside one very dear shortcut.
    n = 300
    chain = [[i, i + 1, 1] for i in range(n - 1)] + [[0, n - 1, 10**4]]
    yield _case(n, chain, 0, n - 1, "a cheap chain beside a dear shortcut")

    for _ in range(2):
        n = rng.randint(500, 3000)
        yield _case(n, _weighted(rng, n, rng.randint(n, n * 3), 10**4, connected=True), 0, n - 1)

    n = 10**4
    roads = _weighted(rng, n, 5 * 10**4, 10**4, connected=True)
    yield _case(n, roads, 0, n - 1, "the stated maxima, where relaxing every road n times cannot finish")
    yield _case(n, roads, n // 2, n // 3, "the stated maxima, between two inner places")
