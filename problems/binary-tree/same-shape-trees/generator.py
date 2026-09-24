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


def _case(first: List[Any], second: List[Any], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [first, second]}
    if name:
        case["name"] = name
    return case


def _copy(tree: Tree) -> Tree:
    if tree is None:
        return None
    root: List[Any] = [tree[0], None, None]
    stack = [(tree, root)]
    while stack:
        source, target = stack.pop()
        for slot in (1, 2):
            if source[slot] is not None:
                target[slot] = [source[slot][0], None, None]
                stack.append((source[slot], target[slot]))
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


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([], [], "two empty trees")
    yield _case([], [1], "one empty, one not")
    yield _case([1], [1], "two single nodes, equal")
    yield _case([1], [2], "two single nodes, different")
    yield _case([1, 2], [1, None, 2], "the same values on opposite sides")
    # Equal in-order readings, different shapes: comparing the values a
    # traversal visits, without the gaps, calls these the same.
    yield _case([2, 1], [1, None, 2], "the same in-order reading, different shapes")
    yield _case([1, 2, 3], [1, 2, 3], "identical trees")
    yield _case([-(10**9)], [10**9], "the extremes of the stated range")

    for n in (3, 8, 25, 120):
        tree = _random_tree(rng, n, -20, 20)
        yield _case(_encode(tree), _encode(_copy(tree)))

        # The same tree with one value changed.
        changed = _copy(tree)
        nodes = _nodes(changed)
        nodes[rng.randrange(len(nodes))][0] += 1
        yield _case(_encode(tree), _encode(changed))

        # A different shape of the same size.
        yield _case(_encode(tree), _encode(_random_tree(rng, n, -20, 20)))

    big = _random_tree(rng, 2000, -(10**9), 10**9)
    yield _case(_encode(big), _encode(_copy(big)), "the stated maximum, equal")
    chain = _chain(rng, 2000, -10, 10)
    other = _copy(chain)
    _nodes(other)[-1][0] += 1
    yield _case(_encode(chain), _encode(other), "the stated maximum as chains, differing once")
