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


def _case(n: int, rules: List[List[int]], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [n, rules]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case(1, [], "one course")
    yield _case(3, [], "no rules at all")
    yield _case(2, [[0, 1]], "one rule")
    yield _case(2, [[1, 0]], "one rule, the other way")
    yield _case(2, [[0, 1], [1, 0]], "an impossible pair")
    yield _case(4, [[0, 1], [0, 2], [1, 3], [2, 3]], "a diamond")
    yield _case(3, [[0, 1], [1, 2], [2, 0]], "a three-way cycle")

    for n, m in ((5, 4), (12, 10), (40, 50), (120, 200)):
        yield _case(n, _acyclic(rng, n, m))
        # A random directed graph, which usually contains a cycle.
        yield _case(n, _directed(rng, n, m))

    # Acyclic but with a single long chain, so the order is forced.
    yield _case(300, [[i, i + 1] for i in range(299)], "a chain of three hundred")

    for _ in range(2):
        n = rng.randint(500, 3000)
        yield _case(n, _acyclic(rng, n, rng.randint(n, n * 2)))

    n = 10**4
    yield _case(n, [], "the stated maximum with no rules, where re-scanning cannot finish")
    yield _case(n, _acyclic(rng, n, 2 * 10**4), "the stated maxima")
    yield _case(n, _directed(rng, n, 2 * 10**4), "the stated maxima, usually cyclic")
