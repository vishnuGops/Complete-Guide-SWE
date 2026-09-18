import random
from typing import Any, Dict, Iterator, List, Optional

Tree = Optional[List[Any]]  # [value, left, right]


def _encode(tree: Tree) -> List[Any]:
    """Level order with explicit nulls and trailing nulls trimmed (the wire form)."""
    if tree is None:
        return []
    out: List[Any] = []
    queue: List[Tree] = [tree]
    at = 0
    while at < len(queue):
        node = queue[at]
        at += 1
        if node is None:
            out.append(None)
            continue
        out.append(node[0])
        queue.append(node[1])
        queue.append(node[2])
    while out and out[-1] is None:
        out.pop()
    return out


def _random_tree(rng: random.Random, n: int, low: int, high: int) -> Tree:
    """A random shape: each new node takes a free child slot chosen at random."""
    if n == 0:
        return None
    nodes: List[List[Any]] = [[rng.randint(low, high), None, None] for _ in range(n)]
    free = [(0, 1), (0, 2)]
    for index in range(1, n):
        which = rng.randrange(len(free))
        parent, slot = free.pop(which)
        nodes[parent][slot] = nodes[index]
        free.append((index, 1))
        free.append((index, 2))
    return nodes[0]


def _chain(rng: random.Random, n: int, low: int, high: int, left: bool = True) -> Tree:
    """A degenerate tree: n nodes, depth n."""
    if n == 0:
        return None
    nodes: List[List[Any]] = [[rng.randint(low, high), None, None] for _ in range(n)]
    for index in range(n - 1):
        nodes[index][1 if left else 2] = nodes[index + 1]
    return nodes[0]


def _full(rng: random.Random, depth: int, low: int, high: int) -> Tree:
    """A complete tree of the given depth."""
    if depth == 0:
        return None
    levels: List[List[List[Any]]] = []
    for level in range(depth):
        levels.append([[rng.randint(low, high), None, None] for _ in range(2 ** level)])
    for level in range(depth - 1):
        for index, node in enumerate(levels[level]):
            node[1] = levels[level + 1][2 * index]
            node[2] = levels[level + 1][2 * index + 1]
    return levels[0][0]


def _case(values: List[Any], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [values]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([1], "a single node")
    yield _case([-3], "a single negative node")
    yield _case([1, 2, 3], "the path turns at the root")
    yield _case([-10, 9, 20, None, None, 15, 7], "the best path is below the root")
    yield _case([-1, -2, -3], "every value negative")
    yield _case([1000, 1000, 1000], "the extremes of the stated value range")
    yield _case([2, -1, -1], "both sides are worth dropping")

    for n in (3, 9, 30, 150):
        yield _case(_encode(_random_tree(rng, n, -20, 20)))
        yield _case(_encode(_random_tree(rng, n, -20, -1)))

    for depth in (4, 8):
        yield _case(_encode(_full(rng, depth, -50, 50)))

    yield _case(_encode(_chain(rng, 1000, -5, 5)), "a long chain")
    yield _case(_encode(_full(rng, 12, -1000, 1000)), "a full tree of four thousand nodes")

    yield _case(
        _encode(_chain(rng, 10**4, -1000, 1000)),
        "the stated maximum as a chain, where a per-node subtree walk cannot finish",
    )
    yield _case(_encode(_random_tree(rng, 10**4, -1000, 1000)), "the stated maximum")
