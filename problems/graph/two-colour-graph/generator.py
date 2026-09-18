import random
from typing import Any, Dict, Iterator, List, Tuple


def _undirected(rng: random.Random, n: int, m: int) -> List[List[int]]:
    """`m` distinct undirected edges over `n` vertices, no self-loops."""
    if n < 2:
        return []
    seen = set()
    edges: List[List[int]] = []
    attempts = 0
    while len(edges) < m and attempts < m * 8:
        attempts += 1
        u = rng.randrange(n)
        v = rng.randrange(n)
        if u == v:
            continue
        key = (min(u, v), max(u, v))
        if key in seen:
            continue
        seen.add(key)
        edges.append([key[0], key[1]])
    return edges


def _directed(rng: random.Random, n: int, m: int, loops: bool = False) -> List[List[int]]:
    """`m` distinct directed edges over `n` vertices."""
    seen = set()
    edges: List[List[int]] = []
    attempts = 0
    while len(edges) < m and attempts < m * 8:
        attempts += 1
        u = rng.randrange(n)
        v = rng.randrange(n)
        if u == v and not loops:
            continue
        if (u, v) in seen:
            continue
        seen.add((u, v))
        edges.append([u, v])
    return edges


def _acyclic(rng: random.Random, n: int, m: int) -> List[List[int]]:
    """`m` distinct edges that always run from an earlier vertex to a later one,
    over a random relabelling - so the graph is acyclic but does not look it."""
    order = list(range(n))
    rng.shuffle(order)
    seen = set()
    edges: List[List[int]] = []
    attempts = 0
    while len(edges) < m and attempts < m * 8:
        attempts += 1
        i = rng.randrange(n)
        j = rng.randrange(n)
        if i == j:
            continue
        if i > j:
            i, j = j, i
        if (i, j) in seen:
            continue
        seen.add((i, j))
        edges.append([order[i], order[j]])
    return edges


def _bipartite(rng: random.Random, n: int, m: int) -> List[List[int]]:
    """Edges only between two halves, so the graph is two-colourable."""
    side = [rng.randrange(2) for _ in range(n)]
    left = [v for v in range(n) if side[v] == 0]
    right = [v for v in range(n) if side[v] == 1]
    if not left or not right:
        return []
    seen = set()
    edges: List[List[int]] = []
    attempts = 0
    while len(edges) < m and attempts < m * 8:
        attempts += 1
        u = rng.choice(left)
        v = rng.choice(right)
        key = (min(u, v), max(u, v))
        if key in seen:
            continue
        seen.add(key)
        edges.append([key[0], key[1]])
    return edges


def _case(n: int, dislikes: List[List[int]], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [n, dislikes]}
    if name:
        case["name"] = name
    return case


def _ring(n: int) -> List[List[int]]:
    return [[i, (i + 1) % n] for i in range(n)]


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case(1, [], "one person")
    yield _case(5, [], "nobody dislikes anybody")
    yield _case(2, [[0, 1]], "one pair")
    yield _case(4, _ring(4), "a ring of four")
    yield _case(3, _ring(3), "a ring of three")
    yield _case(5, _ring(5), "a ring of five")
    yield _case(6, _ring(6), "a ring of six")
    yield _case(7, _ring(4) + [[4, 5]], "an even ring and a separate pair")
    yield _case(7, _ring(3) + [[3, 4], [5, 6]], "an odd ring among innocent pairs")

    for n, m in ((6, 5), (16, 14), (50, 60), (150, 200)):
        yield _case(n, _bipartite(rng, n, m))
        yield _case(n, _undirected(rng, n, m))

    # A long even ring, and the same ring with one extra person spliced in.
    yield _case(400, _ring(400), "an even ring of four hundred")
    yield _case(401, _ring(401), "an odd ring of four hundred and one")

    for _ in range(2):
        n = rng.randint(500, 3000)
        yield _case(n, _bipartite(rng, n, rng.randint(n, n * 2)))

    n = 10**4
    yield _case(n, _bipartite(rng, n, 2 * 10**4), "the stated maxima, splittable")
    yield _case(n, _undirected(rng, n, 2 * 10**4), "the stated maxima, usually not")
