"""Random operation sequences for tag-index.

Weighted towards add so the index actually fills up, and drawn from a small pool
of items and tags so that re-tagging, removal and repeated counts all happen
often rather than by luck.
"""

import random
import string
from typing import Any, Dict, Iterator, List


def _name(rng: random.Random, pool: int) -> str:
    return "n" + str(rng.randrange(pool))


def _sequence(rng: random.Random, length: int, items: int, tags: int) -> Dict[str, Any]:
    ops: List[Dict[str, Any]] = []
    for _ in range(length):
        choice = rng.choices(
            ["add", "remove", "count", "tagOf"], weights=[6, 2, 3, 2]
        )[0]
        if choice == "add":
            ops.append({"method": "add", "args": [_name(rng, items), _name(rng, tags)]})
        elif choice == "remove":
            ops.append({"method": "remove", "args": [_name(rng, items)]})
        elif choice == "count":
            ops.append({"method": "count", "args": [_name(rng, tags)]})
        else:
            ops.append({"method": "tagOf", "args": [_name(rng, items)]})
    return {"args": [], "ops": ops}


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield {
        "args": [],
        "ops": [{"method": "count", "args": ["unknown"]}],
        "name": "count before anything exists",
    }
    yield {
        "args": [],
        "ops": [
            {"method": "add", "args": ["a", "red"]},
            {"method": "add", "args": ["a", "red"]},
            {"method": "count", "args": ["red"]},
        ],
        "name": "re-adding the same tag keeps the count at one",
    }
    yield {
        "args": [],
        "ops": [
            {"method": "add", "args": ["a", "red"]},
            {"method": "remove", "args": ["a"]},
            {"method": "count", "args": ["red"]},
            {"method": "tagOf", "args": ["a"]},
        ],
        "name": "the last item leaves a tag",
    }
    yield {
        "args": [],
        "ops": [
            {"method": "remove", "args": ["ghost"]},
            {"method": "tagOf", "args": ["ghost"]},
            {"method": "count", "args": ["ghost"]},
        ],
        "name": "operations on an item that never existed",
    }

    for length, items, tags in ((10, 3, 2), (40, 8, 3), (120, 20, 5)):
        yield _sequence(rng, length, items, tags)

    for _ in range(4):
        yield _sequence(rng, rng.randint(200, 600), rng.randint(5, 40), rng.randint(2, 8))

    yield _sequence(rng, 4000, 200, 12)
