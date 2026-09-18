"""Random operation sequences for queue-from-stacks.

Weighted towards push so the queue fills, but with enough pops that it drains to
empty repeatedly - draining and refilling is what exercises the transfer, and
interleaved pushes and pops are what catch a transfer done at the wrong moment.
"""

import random
from typing import Any, Dict, Iterator, List


def _sequence(rng: random.Random, length: int, push_weight: int) -> Dict[str, Any]:
    ops: List[Dict[str, Any]] = []
    for _ in range(length):
        choice = rng.choices(
            ["push", "pop", "peek", "empty"], weights=[push_weight, 4, 3, 2]
        )[0]
        if choice == "push":
            ops.append({"method": "push", "args": [rng.randint(-(10**9), 10**9)]})
        else:
            ops.append({"method": choice, "args": []})
    return {"args": [], "ops": ops}


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield {
        "args": [],
        "ops": [{"method": "pop", "args": []}, {"method": "empty", "args": []}],
        "name": "popping an empty queue",
    }
    yield {
        "args": [],
        "ops": [{"method": "peek", "args": []}, {"method": "peek", "args": []}],
        "name": "peeking an empty queue twice",
    }
    yield {
        "args": [],
        "ops": [
            {"method": "push", "args": [1]},
            {"method": "push", "args": [2]},
            {"method": "push", "args": [3]},
            {"method": "pop", "args": []},
            {"method": "push", "args": [4]},
            {"method": "pop", "args": []},
            {"method": "pop", "args": []},
            {"method": "pop", "args": []},
            {"method": "pop", "args": []},
        ],
        "name": "a push arriving after the transfer",
    }
    yield {
        "args": [],
        "ops": [{"method": "push", "args": [7]}, {"method": "peek", "args": []},
                {"method": "peek", "args": []}, {"method": "pop", "args": []},
                {"method": "empty", "args": []}],
        "name": "peek does not remove",
    }
    yield {
        "args": [],
        "ops": ([{"method": "push", "args": [i]} for i in range(50)]
                + [{"method": "pop", "args": []} for _ in range(50)]
                + [{"method": "empty", "args": []}]),
        "name": "fill completely, then drain completely",
    }
    yield {
        "args": [],
        "ops": [{"method": "push", "args": [-(10**9)]}, {"method": "push", "args": [10**9]},
                {"method": "pop", "args": []}, {"method": "pop", "args": []}],
        "name": "the extremes of the stated value range",
    }

    for length, push_weight in ((10, 6), (40, 5), (120, 4), (300, 3)):
        yield _sequence(rng, length, push_weight)

    # Heavy on pops, so the queue is empty most of the time.
    yield _sequence(rng, 200, 1)

    yield _sequence(rng, 2000, 4)
