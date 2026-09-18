"""Random operation sequences for time-keyed-store.

Times per key are kept strictly increasing, as the statement promises. Queries
are drawn from exactly on a stored time, between two of them, before the first
and after the last, since those four are the whole of the boundary search.
"""

import random
from typing import Any, Dict, Iterator, List


def _sequence(ops: List[Dict[str, Any]], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [], "ops": ops}
    if name:
        case["name"] = name
    return case


def _run(rng: random.Random, keys: int, per_key: int, queries: int) -> List[Dict[str, Any]]:
    names = ["k%d" % i for i in range(keys)]
    stamps: Dict[str, List[int]] = {name: [] for name in names}
    ops: List[Dict[str, Any]] = []

    for name in names:
        at = rng.randint(1, 50)
        for index in range(per_key):
            ops.append({"method": "set", "args": [name, "v%d%d" % (names.index(name), index), at]})
            stamps[name].append(at)
            at += rng.randint(1, 100)

    for _ in range(queries):
        name = rng.choice(names + ["absent"])
        known = stamps.get(name) or [1]
        pick = rng.random()
        if pick < 0.3:
            at = rng.choice(known)
        elif pick < 0.55:
            at = rng.choice(known) + rng.randint(1, 50)
        elif pick < 0.8:
            at = max(1, known[0] - rng.randint(1, 20))
        else:
            at = rng.randint(1, 10**7)
        ops.append({"method": "get", "args": [name, at]})

    rng.shuffle(ops)
    # Keep each key's sets in increasing time order after the shuffle.
    sets = [op for op in ops if op["method"] == "set"]
    gets = [op for op in ops if op["method"] == "get"]
    sets.sort(key=lambda op: (op["args"][0], op["args"][2]))
    return sets + gets


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _sequence([{"method": "get", "args": ["missing", 1]}], "a key that was never set")
    yield _sequence([
        {"method": "set", "args": ["a", "one", 10]},
        {"method": "get", "args": ["a", 5]},
    ], "asking before the first value")
    yield _sequence([
        {"method": "set", "args": ["a", "one", 1]},
        {"method": "get", "args": ["a", 1]},
        {"method": "get", "args": ["a", 3]},
        {"method": "set", "args": ["a", "two", 4]},
        {"method": "get", "args": ["a", 4]},
        {"method": "get", "args": ["a", 5]},
    ], "two values over time")
    yield _sequence([
        {"method": "set", "args": ["a", "one", 1]},
        {"method": "set", "args": ["b", "two", 1]},
        {"method": "get", "args": ["a", 1]},
        {"method": "get", "args": ["b", 1]},
    ], "two keys at the same time")
    yield _sequence([
        {"method": "set", "args": ["a", "x", 10**7]},
        {"method": "get", "args": ["a", 10**7]},
        {"method": "get", "args": ["a", 10**7 - 1]},
    ], "the largest allowed time")

    yield _sequence([
        {"method": "set", "args": ["a", "one", 1]},
        {"method": "set", "args": ["a", "two", 2]},
        {"method": "set", "args": ["a", "three", 3]},
        {"method": "get", "args": ["a", 2]},
        {"method": "get", "args": ["a", 100]},
        {"method": "get", "args": ["a", 0 + 1]},
    ], "three values in a row")
    yield _sequence([
        {"method": "set", "args": ["a", "x", 5]},
        {"method": "get", "args": ["a", 4]},
        {"method": "get", "args": ["a", 5]},
        {"method": "get", "args": ["a", 6]},
    ], "either side of the only value")

    for keys, per_key, queries in ((1, 3, 8), (2, 4, 12), (3, 5, 20), (5, 8, 40),
                                   (8, 10, 60), (12, 15, 120), (20, 20, 200)):
        yield _sequence(_run(rng, keys, per_key, queries))

    yield _sequence(_run(rng, 1, 200, 300), "one key with a long history")
    yield _sequence(_run(rng, 3, 400, 400), "three keys with long histories")
    yield _sequence(_run(rng, 50, 80, 6000), "the stated maximum")
