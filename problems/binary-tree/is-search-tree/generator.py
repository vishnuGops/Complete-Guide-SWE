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


def _bst(rng: random.Random, values: List[int]) -> Tree:
    """A search tree built by inserting `values` in the order given."""
    if not values:
        return None
    root: List[Any] = [values[0], None, None]
    for value in values[1:]:
        node = root
        while True:
            slot = 1 if value < node[0] else 2
            if node[slot] is None:
                node[slot] = [value, None, None]
                break
            node = node[slot]
    return root


def _balanced_bst(values: List[int]) -> Tree:
    """A search tree of minimal depth over sorted, distinct `values`."""
    if not values:
        return None
    nodes: List[Any] = [None] * len(values)
    pending = [(0, len(values) - 1, None, 0)]
    root: Tree = None
    while pending:
        low, high, parent, slot = pending.pop()
        if low > high:
            continue
        middle = (low + high) // 2
        node: List[Any] = [values[middle], None, None]
        nodes[middle] = node
        if parent is None:
            root = node
        else:
            parent[slot] = node
        pending.append((low, middle - 1, node, 1))
        pending.append((middle + 1, high, node, 2))
    return root


def _case(values: List[Any], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [values]}
    if name:
        case["name"] = name
    return case


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


def _distinct(rng: random.Random, n: int, spread: int) -> List[int]:
    return rng.sample(range(-spread, spread), n)


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([], "the empty tree")
    yield _case([1], "a single node")
    yield _case([2, 1, 3], "a small search tree")
    yield _case([2, 3, 1], "the children the wrong way round")
    yield _case([5, 1, 6, None, None, 4, 7], "locally right, globally wrong")
    yield _case([-(10**9), None, 10**9], "the extremes of the stated range")
    yield _case([10, 5, 15, None, None, 6, 20], "a value one too small, deep on the right")

    for n in (3, 8, 30, 150):
        values = _distinct(rng, n, 10**4)
        tree = _bst(rng, values)
        yield _case(_encode(tree))

        # Swap two values, which almost always breaks the ordering.
        broken = _bst(rng, values)
        nodes = _nodes(broken)
        if len(nodes) > 1:
            first, second = rng.sample(range(len(nodes)), 2)
            nodes[first][0], nodes[second][0] = nodes[second][0], nodes[first][0]
        yield _case(_encode(broken))

        # A tree with no ordering at all.
        yield _case(_encode(_random_tree(rng, n, -50, 50)))

    yield _case(_encode(_balanced_bst(sorted(_distinct(rng, 2000, 10**9)))), "the stated maximum, valid")
    big = _bst(rng, sorted(_distinct(rng, 800, 10**6)))
    yield _case(_encode(big), "a sorted insertion, so the tree is a chain")
    deep = _nodes(big)
    deep[len(deep) // 2][0] = -(10**9)
    yield _case(_encode(big), "the same chain with one value moved out of range")
