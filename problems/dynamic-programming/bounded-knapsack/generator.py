"""Random inputs for bounded-knapsack.

Item sets where the best worth-per-weight ratio is not in the answer are
generated deliberately - a light, efficient item beside two that fill the bag
exactly - because that is what separates the table from the greedy rule.
"""

import random
from typing import Any, Dict, Iterator, List, Tuple


def _case(weights: List[int], worths: List[int], capacity: int, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [weights, worths, capacity]}
    if name:
        case["name"] = name
    return case


def _items(rng: random.Random, n: int, high_weight: int, high_worth: int) -> Tuple[List[int], List[int]]:
    return ([rng.randint(1, high_weight) for _ in range(n)],
            [rng.randint(1, high_worth) for _ in range(n)])


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([1], [1], 0, "no capacity at all")
    yield _case([5], [10], 4, "nothing fits")
    yield _case([1, 1], [3, 4], 1, "room for one")
    yield _case([1, 3, 4, 5], [1, 4, 5, 7], 7, "two items fill the bag exactly")
    yield _case([1000], [1000], 1000, "the extremes of the stated ranges")
    yield _case([2, 2, 2], [3, 3, 3], 5, "an odd capacity with even weights")
    yield _case([1, 6, 7], [10, 40, 45], 7, "the best ratio is not in the answer")

    for n, hw, hv, cap in ((3, 10, 10, 12), (8, 20, 50, 40), (20, 100, 200, 300), (50, 500, 500, 700)):
        weights, worths = _items(rng, n, hw, hv)
        yield _case(weights, worths, cap)
        yield _case(weights, worths, rng.randint(0, 1000))

    # Every item the same, so the answer is a simple multiple.
    yield _case([7] * 30, [11] * 30, 100, "thirty identical items")

    weights, worths = _items(rng, 100, 1000, 1000)
    yield _case(weights, worths, 1000, "the stated maxima")
    yield _case([1] * 100, [rng.randint(1, 1000) for _ in range(100)], 50,
                "the stated maxima with weight one, so the fifty best are taken")
