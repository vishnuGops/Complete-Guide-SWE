"""Random operation sequences for min-value-stack.

The generator never emits `pop`, `top` or `smallest` against an empty stack,
because the statement guarantees they are not called there; a sequence that
violated the guarantee would make the reference the definition of behaviour
rather than the tests.
"""

import random
from typing import Any, Dict, Iterator, List


def _sequence(rng: random.Random, length: int, lo: int, hi: int) -> Dict[str, Any]:
    ops: List[Dict[str, Any]] = []
    size = 0
    for _ in range(length):
        if size == 0:
            choice = "push"
        else:
            choice = rng.choices(
                ["push", "pop", "top", "smallest"], weights=[5, 2, 2, 4]
            )[0]
        if choice == "push":
            ops.append({"method": "push", "args": [rng.randint(lo, hi)]})
            size += 1
        elif choice == "pop":
            ops.append({"method": "pop", "args": []})
            size -= 1
        else:
            ops.append({"method": choice, "args": []})
    return {"args": [], "ops": ops}


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield {
        "args": [],
        "ops": [{"method": "push", "args": [0]}, {"method": "smallest", "args": []}],
        "name": "single element",
    }
    yield {
        "args": [],
        "ops": [
            {"method": "push", "args": [5]},
            {"method": "push", "args": [5]},
            {"method": "pop", "args": []},
            {"method": "smallest", "args": []},
        ],
        "name": "duplicate minimum survives one pop",
    }
    yield {
        "args": [],
        "ops": [
            {"method": "push", "args": [-(10**9)]},
            {"method": "push", "args": [10**9]},
            {"method": "smallest", "args": []},
            {"method": "pop", "args": []},
            {"method": "top", "args": []},
        ],
        "name": "extreme values",
    }
    yield {
        "args": [],
        "ops": [
            {"method": "push", "args": [i]} for i in range(6)
        ] + [{"method": "smallest", "args": []}],
        "name": "strictly increasing pushes",
    }
    yield {
        "args": [],
        "ops": [
            {"method": "push", "args": [-i]} for i in range(6)
        ] + [{"method": "smallest", "args": []}],
        "name": "strictly decreasing pushes",
    }
    yield {
        "args": [],
        "ops": [
            {"method": "push", "args": [3]},
            {"method": "push", "args": [1]},
            {"method": "pop", "args": []},
            {"method": "smallest", "args": []},
            {"method": "push", "args": [2]},
            {"method": "smallest", "args": []},
        ],
        "name": "minimum restored after the smallest element leaves",
    }

    for length in (8, 20, 50):
        yield _sequence(rng, length, -50, 50)
    for _ in range(3):
        yield _sequence(rng, rng.randint(100, 400), -10**9, 10**9)
    # The stated maximum: "at most 10^4 calls in total" (D21, P6-0). Every
    # operation is meant to be O(1), and a sequence at the stated length is the
    # only test that would notice one that is not.
    yield {
        **_sequence(rng, 10**4, -(10**6), 10**6),
        "name": "the stated maximum number of calls",
    }
