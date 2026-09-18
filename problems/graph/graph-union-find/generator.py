"""Random operation sequences for graph-union-find.

Weighted towards `link` so the groups actually merge, with questions interleaved
rather than asked at the end - that interleaving is the whole reason the problem
exists. One sequence links everything into a single chain in order, which is the
shape that degenerates without union by size.
"""

import random
from typing import Any, Dict, Iterator, List


def _sequence(n: int, ops: List[Dict[str, Any]], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [n], "ops": ops}
    if name:
        case["name"] = name
    return case


def _random_ops(rng: random.Random, n: int, count: int) -> List[Dict[str, Any]]:
    ops: List[Dict[str, Any]] = []
    for _ in range(count):
        choice = rng.choices(["link", "joined", "groups", "sizeOf"], weights=[6, 4, 2, 2])[0]
        if choice in ("link", "joined"):
            ops.append({"method": choice, "args": [rng.randrange(n), rng.randrange(n)]})
        elif choice == "groups":
            ops.append({"method": "groups", "args": []})
        else:
            ops.append({"method": "sizeOf", "args": [rng.randrange(n)]})
    return ops


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _sequence(1, [{"method": "groups", "args": []}, {"method": "sizeOf", "args": [0]}],
                    "one machine on its own")
    yield _sequence(4, [
        {"method": "link", "args": [0, 1]},
        {"method": "link", "args": [1, 2]},
        {"method": "joined", "args": [0, 2]},
        {"method": "groups", "args": []},
    ], "three machines joined into one group")
    yield _sequence(3, [{"method": "link", "args": [0, 1]}, {"method": "link", "args": [1, 0]}],
                    "a connection that joins nothing")
    yield _sequence(2, [
        {"method": "sizeOf", "args": [0]},
        {"method": "link", "args": [0, 1]},
        {"method": "sizeOf", "args": [0]},
    ], "group sizes")
    yield _sequence(3, [
        {"method": "link", "args": [0, 0]},
        {"method": "joined", "args": [1, 1]},
        {"method": "groups", "args": []},
    ], "a machine linked to itself")

    # Everything into one chain, in order: the shape that degenerates without
    # union by size.
    n = 500
    ops = []
    for i in range(n - 1):
        ops.append({"method": "link", "args": [0, i + 1]})
    ops.append({"method": "groups", "args": []})
    ops.append({"method": "sizeOf", "args": [n - 1]})
    yield _sequence(n, ops, "a star built one machine at a time")

    # A chain built end to end, which is the other degenerate shape.
    n = 400
    ops = [{"method": "link", "args": [i, i + 1]} for i in range(n - 1)]
    ops.append({"method": "joined", "args": [0, n - 1]})
    ops.append({"method": "sizeOf", "args": [0]})
    yield _sequence(n, ops, "a chain built end to end")

    # Every link repeated, so half of them join nothing.
    n = 60
    ops = []
    for i in range(n - 1):
        ops.append({"method": "link", "args": [i, i + 1]})
        ops.append({"method": "link", "args": [i, i + 1]})
    ops.append({"method": "groups", "args": []})
    yield _sequence(n, ops, "every link given twice")

    # Questions only, so nothing is ever joined.
    n = 50
    yield _sequence(n, [{"method": "joined", "args": [rng.randrange(n), rng.randrange(n)]}
                        for _ in range(30)] + [{"method": "groups", "args": []}],
                    "questions with no connections at all")

    for n, count in ((5, 12), (8, 25), (20, 40), (50, 80), (100, 150), (500, 600), (2000, 3000)):
        yield _sequence(n, _random_ops(rng, n, count))
        yield _sequence(n, _random_ops(rng, n, count))

    yield _sequence(10**4, _random_ops(rng, 10**4, 2 * 10**4), "the stated maxima")
