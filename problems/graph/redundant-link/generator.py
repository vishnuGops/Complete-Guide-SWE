"""Random inputs for redundant-link.

Every case is built the way the statement describes: a random spanning tree over
all `n` machines, then one extra link between two machines already joined, then
the whole list shuffled into a plausible installation order - so which link
closes the loop genuinely depends on the order rather than being the last one.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(n: int, links: List[List[int]], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [n, links]}
    if name:
        case["name"] = name
    return case


def _network(rng: random.Random, n: int, shape: str = "random") -> List[List[int]]:
    """A spanning tree plus exactly one extra link, in a shuffled order."""
    order = list(range(n))
    rng.shuffle(order)
    tree: List[List[int]] = []
    for index in range(1, n):
        if shape == "chain":
            parent = index - 1
        elif shape == "star":
            parent = 0
        else:
            parent = rng.randrange(index)
        tree.append([order[parent], order[index]])

    seen = {(min(a, b), max(a, b)) for a, b in tree}
    while True:
        a = rng.randrange(n)
        b = rng.randrange(n)
        if a == b:
            continue
        key = (min(a, b), max(a, b))
        if key not in seen:
            tree.append([key[0], key[1]])
            break

    rng.shuffle(tree)
    return tree


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case(3, [[0, 1], [1, 2], [0, 2]], "a triangle")
    yield _case(4, [[0, 1], [0, 2], [0, 3], [1, 2]], "a star with one extra link")
    yield _case(3, [[0, 2], [0, 1], [1, 2]], "the same triangle, installed differently")
    yield _case(3, [[0, 1], [0, 2], [1, 2]], "the loop closed by the last link")

    for n in (4, 7, 20, 60, 200):
        yield _case(n, _network(rng, n))
        yield _case(n, _network(rng, n, shape="chain"))
        yield _case(n, _network(rng, n, shape="star"))

    for _ in range(2):
        n = rng.randint(500, 3000)
        yield _case(n, _network(rng, n))

    n = 10**4
    yield _case(n, _network(rng, n), "the stated maximum")
    yield _case(n, _network(rng, n, shape="chain"), "the stated maximum as a chain")
