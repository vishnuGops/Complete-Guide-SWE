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


def _left_heavy(rng: random.Random, n: int, low: int, high: int) -> Tree:
    """Mostly left children, so the right spine is short and the view is not."""
    if n == 0:
        return None
    nodes: List[List[Any]] = [[rng.randint(low, high), None, None] for _ in range(n)]
    free = [(0, 1), (0, 2)]
    for index in range(1, n):
        lefts = [k for k, (_, slot) in enumerate(free) if slot == 1]
        which = rng.choice(lefts) if lefts and rng.random() < 0.85 else rng.randrange(len(free))
        parent, slot = free.pop(which)
        nodes[parent][slot] = nodes[index]
        free.append((index, 1))
        free.append((index, 2))
    return nodes[0]


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([], "the empty tree")
    yield _case([1], "a single node")
    yield _case([1, 2], "a left child with nothing to its right")
    yield _case([1, None, 2], "a right child")
    yield _case([1, 2, 3, None, 5, None, 4], "one node visible per level")
    yield _case([-(10**9), 10**9], "the extremes of the stated range")
    yield _case(_encode(_chain(rng, 6, -10, 10, left=True)), "a left chain, where the right spine is one node")

    for n in (3, 8, 25, 120):
        yield _case(_encode(_random_tree(rng, n, -50, 50)))
        yield _case(_encode(_left_heavy(rng, n, -50, 50)))

    for depth in (4, 8):
        yield _case(_encode(_full(rng, depth, -100, 100)))

    yield _case(_encode(_left_heavy(rng, 2000, -(10**9), 10**9)), "the stated maximum, leaning left")
    yield _case(_encode(_chain(rng, 2000, -10, 10, left=True)), "the stated maximum as a left chain")
