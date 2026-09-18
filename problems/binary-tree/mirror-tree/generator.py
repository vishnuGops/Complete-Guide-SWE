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


def _reflect(tree: Tree) -> Tree:
    """A mirror image, built iteratively."""
    if tree is None:
        return None
    root: List[Any] = [tree[0], None, None]
    stack = [(tree, root)]
    while stack:
        source, target = stack.pop()
        if source[1] is not None:
            target[2] = [source[1][0], None, None]
            stack.append((source[1], target[2]))
        if source[2] is not None:
            target[1] = [source[2][0], None, None]
            stack.append((source[2], target[1]))
    return root


def _nodes(tree: Tree) -> List[List[Any]]:
    out: List[List[Any]] = []
    stack = [tree]
    while stack:
        node = stack.pop()
        if node is None:
            continue
        out.append(node)
        stack.append(node[1])
        stack.append(node[2])
    return out


def _symmetric(rng: random.Random, n: int, low: int, high: int) -> Tree:
    """A tree that is its own reflection: half a tree and its mirror."""
    half = _random_tree(rng, n, low, high)
    return [rng.randint(low, high), half, _reflect(half)]


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([], "the empty tree")
    yield _case([1], "a single node")
    yield _case([1, 2], "a root with one child")
    yield _case([1, 2, 2], "two children with equal values")
    yield _case([1, 2, 3], "two children with different values")
    yield _case([1, 2, 2, 3, 4, 4, 3], "a reflection")
    yield _case([1, 2, 2, None, 3, None, 3], "the same values, the wrong sides")
    yield _case([-(10**9), 10**9, 10**9], "the extremes of the stated range")

    for n in (1, 3, 7, 20, 90):
        yield _case(_encode(_symmetric(rng, n, -5, 5)))
        # A reflection broken at one node.
        broken = _symmetric(rng, n, -5, 5)
        nodes = _nodes(broken)
        nodes[rng.randrange(len(nodes))][0] += 100
        yield _case(_encode(broken))
        yield _case(_encode(_random_tree(rng, 2 * n + 1, -5, 5)))

    yield _case(_encode(_symmetric(rng, 999, -10, 10)), "the stated maximum, a reflection")
    yield _case(_encode(_chain(rng, 2000, -10, 10)), "the stated maximum as a chain")
