"""Random operation sequences for sparse-vector-dot.

Rows are drawn sparse on purpose - a few per cent of slots carry a reading - so
that the overlap between two rows is usually small and occasionally empty. Names
come from a small pool so that replacement, repeated dot products and unknown
names all happen often rather than by luck.
"""

import random
from typing import Any, Dict, Iterator, List

NAMES = ["a", "b", "c", "d"]


def _row(rng: random.Random, length: int, density: float) -> List[int]:
    return [
        rng.choice([-100, -7, -1, 1, 3, 100]) if rng.random() < density else 0
        for _ in range(length)
    ]


def _sequence(rng: random.Random, adds: int, queries: int, length: int, density: float) -> Dict[str, Any]:
    ops: List[Dict[str, Any]] = []
    for _ in range(adds):
        ops.append({"method": "add", "args": [rng.choice(NAMES), _row(rng, length, density)]})
    for _ in range(queries):
        if rng.random() < 0.7:
            ops.append({"method": "dot", "args": [rng.choice(NAMES), rng.choice(NAMES)]})
        else:
            ops.append({"method": "nonZeroCount", "args": [rng.choice(NAMES + ["missing"])]})
    return {"args": [], "ops": ops}


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield {
        "args": [],
        "ops": [{"method": "dot", "args": ["a", "b"]}],
        "name": "a dot product before anything is stored",
    }
    yield {
        "args": [],
        "ops": [
            {"method": "add", "args": ["a", [0, 0, 0, 0]]},
            {"method": "add", "args": ["b", [1, 2, 3, 4]]},
            {"method": "dot", "args": ["a", "b"]},
            {"method": "nonZeroCount", "args": ["a"]},
        ],
        "name": "an all-zero row against a dense one",
    }
    yield {
        "args": [],
        "ops": [
            {"method": "add", "args": ["a", [100, 100, 100]]},
            {"method": "dot", "args": ["a", "a"]},
        ],
        "name": "a row multiplied by itself at the extreme value",
    }
    yield {
        "args": [],
        "ops": [
            {"method": "add", "args": ["a", [1, 2, 3]]},
            {"method": "add", "args": ["a", [0, 0, 5]]},
            {"method": "nonZeroCount", "args": ["a"]},
            {"method": "dot", "args": ["a", "a"]},
        ],
        "name": "a second add replaces the first",
    }
    yield {
        "args": [],
        "ops": [
            {"method": "add", "args": ["a", [7, 0, 0, 0, 0]]},
            {"method": "add", "args": ["b", [0, 0, 0, 0, 9]]},
            {"method": "dot", "args": ["a", "b"]},
        ],
        "name": "rows that share no position",
    }
    yield {
        "args": [],
        "ops": [
            {"method": "add", "args": ["a", [1, 2, 3, 4, 5]]},
            {"method": "add", "args": ["b", [6, 7]]},
            {"method": "dot", "args": ["a", "b"]},
        ],
        "name": "rows of different lengths",
    }

    for adds, queries, length, density in (
        (3, 6, 10, 0.5),
        (5, 12, 60, 0.2),
        (6, 20, 200, 0.05),
        (4, 30, 40, 0.9),
    ):
        yield _sequence(rng, adds, queries, length, density)

    for _ in range(2):
        yield _sequence(rng, rng.randint(4, 8), rng.randint(20, 60), rng.randint(300, 900), 0.03)

    # The stated maxima: rows of ten thousand slots, and dot products over them.
    yield {
        "args": [],
        "ops": [
            {"method": "add", "args": ["a", _row(rng, 10**4, 0.01)]},
            {"method": "add", "args": ["b", _row(rng, 10**4, 0.01)]},
            {"method": "add", "args": ["c", _row(rng, 10**4, 0.5)]},
            {"method": "dot", "args": ["a", "b"]},
            {"method": "dot", "args": ["a", "c"]},
            {"method": "dot", "args": ["c", "c"]},
            {"method": "nonZeroCount", "args": ["c"]},
        ],
        "name": "the stated maximum row length",
    }
