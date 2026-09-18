"""Random operation sequences for browser-history.

Weighted so that the history grows, is walked back into, and is then truncated
by a fresh visit - which is the rule the problem exists for. Step counts often
exceed the history's length, so both clamps are exercised.
"""

import random
from typing import Any, Dict, Iterator, List


def _page(rng: random.Random) -> str:
    return "p" + str(rng.randrange(1000))


def _sequence(rng: random.Random, length: int, visit_weight: int) -> Dict[str, Any]:
    ops: List[Dict[str, Any]] = []
    for _ in range(length):
        choice = rng.choices(["visit", "back", "forward"], weights=[visit_weight, 4, 3])[0]
        if choice == "visit":
            ops.append({"method": "visit", "args": [_page(rng)]})
        else:
            ops.append({"method": choice, "args": [rng.randint(1, 100)]})
    return {"args": ["home"], "ops": ops}


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield {
        "args": ["home"],
        "ops": [{"method": "back", "args": [10]}],
        "name": "going back from the home page",
    }
    yield {
        "args": ["home"],
        "ops": [{"method": "forward", "args": [10]}],
        "name": "going forward with nothing ahead",
    }
    yield {
        "args": ["home"],
        "ops": [
            {"method": "visit", "args": ["a"]},
            {"method": "back", "args": [1]},
            {"method": "visit", "args": ["b"]},
            {"method": "forward", "args": [1]},
            {"method": "back", "args": [100]},
        ],
        "name": "a visit discarding the forward history",
    }
    yield {
        "args": ["home"],
        "ops": ([{"method": "visit", "args": ["p" + str(i)]} for i in range(30)]
                + [{"method": "back", "args": [100]}]
                + [{"method": "forward", "args": [100]}]),
        "name": "all the way back and all the way forward",
    }
    yield {
        "args": ["home"],
        "ops": [
            {"method": "visit", "args": ["a"]},
            {"method": "visit", "args": ["b"]},
            {"method": "back", "args": [1]},
            {"method": "back", "args": [1]},
            {"method": "forward", "args": [1]},
            {"method": "forward", "args": [1]},
        ],
        "name": "one step at a time in both directions",
    }
    yield {
        "args": ["x" * 20],
        "ops": [{"method": "visit", "args": ["y" * 20]}, {"method": "back", "args": [1]}],
        "name": "the longest allowed page names",
    }

    for length, visit_weight in ((8, 6), (30, 5), (100, 4), (400, 3)):
        yield _sequence(rng, length, visit_weight)

    # Mostly navigation, so the clamps carry the sequence.
    yield _sequence(rng, 300, 1)

    yield _sequence(rng, 2000, 4)
