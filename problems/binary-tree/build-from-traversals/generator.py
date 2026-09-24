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


def _case(preorder: List[int], inorder: List[int], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [preorder, inorder]}
    if name:
        case["name"] = name
    return case


def _distinct_tree(rng: random.Random, n: int, spread: int) -> Tree:
    values = rng.sample(range(-spread, spread), n)
    nodes: List[List[Any]] = [[value, None, None] for value in values]
    free = [(0, 1), (0, 2)]
    for index in range(1, n):
        which = rng.randrange(len(free))
        parent, slot = free.pop(which)
        nodes[parent][slot] = nodes[index]
        free.append((index, 1))
        free.append((index, 2))
    return nodes[0]


def _distinct_chain(rng: random.Random, n: int, spread: int, left: bool = True) -> Tree:
    values = rng.sample(range(-spread, spread), n)
    nodes: List[List[Any]] = [[value, None, None] for value in values]
    for index in range(n - 1):
        nodes[index][1 if left else 2] = nodes[index + 1]
    return nodes[0]


def _readings(tree: Tree) -> Any:
    """Pre-order and in-order, both computed iteratively."""
    pre: List[int] = []
    stack = [tree]
    while stack:
        node = stack.pop()
        if node is None:
            continue
        pre.append(node[0])
        stack.append(node[2])
        stack.append(node[1])

    into: List[int] = []
    stack = []
    node = tree
    while stack or node is not None:
        while node is not None:
            stack.append(node)
            node = node[1]
        node = stack.pop()
        into.append(node[0])
        node = node[2]

    return pre, into


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([1], [1], "a single node")
    yield _case([1, 2], [2, 1], "one child, on the left")
    yield _case([1, 2], [1, 2], "one child, on the right")
    yield _case([5, 2, 1, 9, 7], [1, 2, 5, 7, 9], "a tree with both subtrees")
    yield _case([-(10**9), 10**9], [10**9, -(10**9)], "the extremes of the stated range")

    for n in (3, 8, 30, 150):
        pre, into = _readings(_distinct_tree(rng, n, 10**5))
        yield _case(pre, into)

    for depth in (3, 6, 9):
        values = rng.sample(range(-(10**6), 10**6), 2 ** depth - 1)
        tree = _full(rng, depth, 0, 0)
        # Relabel with distinct values, iteratively.
        stack = [tree]
        at = 0
        while stack:
            node = stack.pop()
            if node is None:
                continue
            node[0] = values[at]
            at += 1
            stack.append(node[1])
            stack.append(node[2])
        pre, into = _readings(tree)
        yield _case(pre, into)

    for left in (True, False):
        pre, into = _readings(_distinct_chain(rng, 600, 10**6, left=left))
        yield _case(pre, into, "a chain of six hundred, leaning %s" % ("left" if left else "right"))

    pre, into = _readings(_distinct_tree(rng, 10**4, 10**9))
    yield _case(pre, into, "the stated maximum")
    pre, into = _readings(_distinct_chain(rng, 10**4, 10**9, left=True))
    yield _case(pre, into, "the stated maximum as a chain, the worst case for scanning")
