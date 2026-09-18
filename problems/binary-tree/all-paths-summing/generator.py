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


def _case(values: List[Any], target: int, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [values, target]}
    if name:
        case["name"] = name
    return case


def _path_sums(tree: Tree) -> List[int]:
    if tree is None:
        return []
    out: List[int] = []
    stack = [(tree, 0)]
    while stack:
        node, running = stack.pop()
        running += node[0]
        if node[1] is None and node[2] is None:
            out.append(running)
            continue
        if node[1] is not None:
            stack.append((node[1], running))
        if node[2] is not None:
            stack.append((node[2], running))
    return out


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([], 0, "the empty tree")
    yield _case([1], 1, "a single node that matches")
    yield _case([1], 2, "a single node that does not")
    yield _case([1, 2], 1, "the root is not a path")
    yield _case([1, 2, 3], 5, "no path adds up")
    yield _case([5, 4, 8, 11, None, 13, 4, 7, 2, None, None, 5, 1], 22, "two paths that add up")
    yield _case([0, 0, 0], 0, "every path sums to zero")
    yield _case([1000, 1000], 2000, "the extremes of the stated value range")

    for n in (4, 10, 30, 120):
        tree = _random_tree(rng, n, -6, 6)
        sums = _path_sums(tree)
        yield _case(_encode(tree), rng.choice(sums))
        yield _case(_encode(tree), max(sums) + 1)

    # A tree of zeroes, so every root-to-leaf path is an answer at once.
    zeros = _full(rng, 7, 0, 0)
    yield _case(_encode(zeros), 0, "a full tree of zeroes, where every path matches")

    chain = _chain(rng, 400, -3, 3)
    yield _case(_encode(chain), _path_sums(chain)[0], "a long chain, matching its only path")

    big = _random_tree(rng, 2000, -2, 2)
    yield _case(_encode(big), rng.choice(_path_sums(big)), "the stated maximum")
    yield _case(_encode(big), 10**6, "the stated maximum, with the largest target")
