"""Random operation sequences for insert-delete-random.

Values are drawn from a small pool so that adding something already present and
removing something absent both happen constantly. `pick` is only ever emitted
when the set is known to be non-empty, which the generator tracks as it builds
the sequence.
"""

import random
from typing import Any, Dict, Iterator, List


def _sequence(ops: List[Dict[str, Any]], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [], "ops": ops}
    if name:
        case["name"] = name
    return case


def _run(rng: random.Random, length: int, pool: int) -> List[Dict[str, Any]]:
    present = set()
    ops: List[Dict[str, Any]] = []
    for _ in range(length):
        choice = rng.choices(["add", "remove", "pick"], weights=[5, 3, 3])[0]
        if choice == "pick" and not present:
            choice = "add"
        if choice == "add":
            value = rng.randint(-pool, pool)
            present.add(value)
            ops.append({"method": "add", "args": [value]})
        elif choice == "remove":
            value = rng.randint(-pool, pool)
            present.discard(value)
            ops.append({"method": "remove", "args": [value]})
        else:
            ops.append({"method": "pick", "args": []})
    return ops


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _sequence([{"method": "add", "args": [1]}, {"method": "add", "args": [1]}],
                    "adding twice")
    yield _sequence([
        {"method": "add", "args": [5]},
        {"method": "remove", "args": [5]},
        {"method": "remove", "args": [5]},
    ], "removing twice")
    yield _sequence([
        {"method": "add", "args": [1]},
        {"method": "remove", "args": [2]},
        {"method": "add", "args": [2]},
        {"method": "pick", "args": []},
        {"method": "remove", "args": [1]},
        {"method": "pick", "args": []},
    ], "adding, removing and picking")
    yield _sequence([
        {"method": "add", "args": [1]},
        {"method": "add", "args": [2]},
        {"method": "remove", "args": [2]},
        {"method": "pick", "args": []},
    ], "removing the last element added")
    yield _sequence([
        {"method": "add", "args": [-(10**9)]},
        {"method": "add", "args": [10**9]},
        {"method": "pick", "args": []},
        {"method": "remove", "args": [-(10**9)]},
        {"method": "pick", "args": []},
    ], "the extremes of the stated range")
    yield _sequence([{"method": "add", "args": [i]} for i in range(30)]
                    + [{"method": "remove", "args": [i]} for i in range(0, 30, 2)]
                    + [{"method": "pick", "args": []} for _ in range(10)],
                    "thirty added, half removed")

    for length, pool in ((6, 2), (10, 3), (20, 4), (40, 8), (80, 12), (150, 20),
                         (300, 30), (600, 50), (2000, 200)):
        yield _sequence(_run(rng, length, pool))

    yield _sequence(_run(rng, 2 * 10**4, 5000), "the stated maximum")
