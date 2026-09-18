"""Random inputs for first-missing-count.

Only values in 1..n can change the answer, so the cases are built around that
range: a complete permutation (the answer is n + 1), a permutation with one
value replaced (the answer is that value), heavy duplicates, and rows made
entirely of junk.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(values: List[int], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [values]}
    if name:
        case["name"] = name
    return case


def _permutation(rng: random.Random, n: int) -> List[int]:
    values = list(range(1, n + 1))
    rng.shuffle(values)
    return values


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([1], "the shortest complete row")
    yield _case([2], "a single value that is not 1")
    yield _case([-(10**9), 10**9], "the extremes of the stated range, both junk")
    yield _case([0, 0, 0], "zeroes are junk")
    yield _case([2, 2, 2], "one value repeated, and it is not 1")
    yield _case([1, 1, 2, 2, 3, 3], "every value duplicated")

    for n in (4, 12, 40, 120):
        values = _permutation(rng, n)
        yield _case(list(values))
        # Replace one value with junk, so the answer is exactly that value.
        hole = rng.randrange(n)
        replaced = list(values)
        replaced[hole] = rng.choice([-5, 0, n + 7, 10**9])
        yield _case(replaced)

    for _ in range(2):
        n = rng.randint(200, 700)
        yield _case([rng.randint(-20, n + 20) for _ in range(n)])

    # The stated maximum: a complete permutation, so the answer is n + 1 and
    # every candidate from 1 upward has to be ruled out.
    yield _case(
        _permutation(rng, 10**4),
        "the stated maximum, complete, where a scan per candidate cannot finish",
    )
