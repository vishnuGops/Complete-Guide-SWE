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


def _case(written: str, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [written]}
    if name:
        case["name"] = name
    return case


def _preorder_form(tree: Tree) -> str:
    """The pre-order form with every absent child written, computed iteratively."""
    if tree is None:
        return "#"
    out: List[str] = []
    # (node, stage) where stage 0 writes the value, 1 and 2 walk the children.
    stack: List[List[Any]] = [[tree, 0]]
    while stack:
        frame = stack[-1]
        node, stage = frame[0], frame[1]
        if node is None:
            out.append("#")
            stack.pop()
            continue
        if stage == 0:
            out.append(str(node[0]))
            frame[1] = 1
            stack.append([node[1], 0])
        elif stage == 1:
            frame[1] = 2
            stack.append([node[2], 0])
        else:
            stack.pop()
    return ",".join(out)


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case("#", "the empty tree")
    yield _case("1,#,#", "a single node")
    yield _case("1,2,#,#,3,#,#", "a root with two children")
    yield _case("1,2,#,3,#,#,#", "a gap that cannot be dropped")
    yield _case("1,#,2,#,#", "a right child only")
    yield _case(_preorder_form(_chain(rng, 6, -5, 5, left=True)), "a left chain")
    yield _case(_preorder_form([-(10**9), [10**9, None, None], None]), "the extremes of the stated range")

    for n in (2, 5, 15, 60, 250):
        yield _case(_preorder_form(_random_tree(rng, n, -1000, 1000)))

    for depth in (3, 5, 8):
        yield _case(_preorder_form(_full(rng, depth, -100, 100)))

    yield _case(_preorder_form(_chain(rng, 900, -10, 10, left=True)), "a long left chain")
    yield _case(_preorder_form(_chain(rng, 900, -10, 10, left=False)), "a long right chain")

    yield _case(_preorder_form(_random_tree(rng, 10**4, -(10**9), 10**9)), "the stated maximum")
    yield _case(_preorder_form(_chain(rng, 10**4, -(10**9), 10**9)), "the stated maximum as a chain")
