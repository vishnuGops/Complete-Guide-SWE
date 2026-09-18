"""Random inputs for cheapest-k-sums.

Both lists are built sorted and distinct, as the statement requires. Ties in cost
are made common by drawing from arithmetic-looking ranges, because the tie rule
is what separates one correct answer from another.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(first: List[int], second: List[int], k: int, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [first, second, k]}
    if name:
        case["name"] = name
    return case


def _distinct_sorted(rng: random.Random, n: int, spread: int) -> List[int]:
    return sorted(rng.sample(range(-spread, spread), n))


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([1], [1], 1, "one pairing")
    yield _case([1, 7, 11], [2, 4, 6], 3, "the three cheapest")
    yield _case([1, 2], [3], 2, "a single price in the second list")
    yield _case([1, 2], [1, 2], 3, "a tie broken by the first price")
    yield _case([1, 2], [1, 2], 4, "every pairing")
    yield _case([-(10**9)], [10**9], 1, "the extremes of the stated range")
    yield _case(list(range(5)), list(range(5)), 12, "a grid full of ties")

    for n, m, spread in ((2, 3, 10), (5, 5, 20), (9, 4, 50), (30, 20, 200)):
        first = _distinct_sorted(rng, n, spread)
        second = _distinct_sorted(rng, m, spread)
        yield _case(first, second, rng.randint(1, n * m))
        yield _case(first, second, 1)
        yield _case(first, second, min(n * m, 10**4))

    for _ in range(2):
        n = rng.randint(100, 500)
        m = rng.randint(100, 500)
        yield _case(_distinct_sorted(rng, n, 10**6), _distinct_sorted(rng, m, 10**6),
                    rng.randint(1, 2000))

    first = _distinct_sorted(rng, 10**4, 10**9)
    second = _distinct_sorted(rng, 10**4, 10**9)
    yield _case(first, second, 10**4, "the stated maxima, where enumerating every pairing cannot finish")
    yield _case(first, second, 1, "the stated maxima, wanting only the cheapest")
