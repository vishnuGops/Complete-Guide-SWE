"""Random inputs for sum-combinations.

Small values against a large target give many answers and deep recursion; large
values against a small target give none and exercise the pruning. Both are
generated deliberately, and every value list is sampled without replacement as
the statement requires.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(values: List[int], target: int, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [values, target]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([7], 7, "the value is the target")
    yield _case([2], 3, "no combination reaches it")
    yield _case([2], 40, "one value, twenty times")
    yield _case([2, 3, 5], 8, "three values, total eight")
    yield _case([40], 40, "the extremes of the stated ranges")
    yield _case([3, 5, 7], 2, "every value is larger than the target")

    for count, low, high, target in ((2, 2, 8, 12), (4, 2, 10, 15), (6, 3, 20, 25), (8, 5, 40, 30)):
        values = rng.sample(range(low, high + 1), count)
        yield _case(values, target)
        yield _case(values, rng.randint(1, 40))

    yield _case([2, 3], 40, "two small values against the largest target")
    yield _case(list(range(2, 12)), 20, "ten consecutive values")
    yield _case(rng.sample(range(2, 41), 20), 40, "the stated maxima")
    yield _case(rng.sample(range(20, 41), 15), 40, "large values, so few combinations fit")
