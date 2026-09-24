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


def _case(values: List[Any], first: int, second: int, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [values, first, second]}
    if name:
        case["name"] = name
    return case


def _distinct_tree(rng: random.Random, n: int, spread: int) -> Tree:
    """A random shape whose values are distinct, as the statement requires."""
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


def _values(tree: Tree) -> List[int]:
    out: List[int] = []
    stack = [tree]
    while stack:
        node = stack.pop()
        if node is None:
            continue
        out.append(node[0])
        stack.append(node[1])
        stack.append(node[2])
    return out


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([1], 1, 1, "the same node twice")
    yield _case([1, 2], 1, 2, "a root and its only child")
    yield _case([1, 2], 2, 2, "a leaf with itself")
    yield _case([10, 2, 15, 12, 5, 8, 3], 2, 15, "in different subtrees")
    yield _case([10, 2, 15, 12, 5, 8, 3], 15, 3, "one is above the other")
    yield _case([10, 2, 15, 12, 5, 8, 3], 12, 3, "two leaves far apart")
    yield _case([-(10**9), 10**9], -(10**9), 10**9, "the extremes of the stated range")

    for n in (3, 8, 30, 150):
        tree = _distinct_tree(rng, n, 10**4)
        values = _values(tree)
        for _ in range(2):
            yield _case(_encode(tree), rng.choice(values), rng.choice(values))
        yield _case(_encode(tree), values[0], rng.choice(values))

    # A long chain, numbered top to bottom so its values are distinct.
    chain = _chain(rng, 500, 0, 0)
    node = chain
    counter = 0
    while node is not None:
        node[0] = counter
        counter += 1
        node = node[1] if node[1] is not None else node[2]
    yield _case(_encode(chain), 0, 499, "a long chain, root and deepest leaf")
    yield _case(_encode(chain), 250, 499, "a long chain, both on the same line")

    big = _distinct_tree(rng, 2000, 10**9)
    values = _values(big)
    yield _case(_encode(big), rng.choice(values), rng.choice(values), "the stated maximum")
    yield _case(_encode(big), values[0], values[-1], "the stated maximum, root and a far leaf")
