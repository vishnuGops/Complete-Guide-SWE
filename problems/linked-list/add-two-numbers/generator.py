"""Random inputs for add-two-numbers.

Digits are generated so that the stated no-leading-zero rule holds: the last
link is never 0 unless the chain is exactly [0]. Long runs of 9s are over-
represented, because a carry that ripples the whole length is where the final
carry is dropped.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(first: List[int], second: List[int], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [first, second]}
    if name:
        case["name"] = name
    return case


def _number(rng: random.Random, digits: int) -> List[int]:
    """Digits least significant first, with no leading zero."""
    if digits == 1:
        return [rng.randint(0, 9)]
    return [rng.randint(0, 9) for _ in range(digits - 1)] + [rng.randint(1, 9)]


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([0], [0], "zero plus zero")
    yield _case([0], [5], "zero plus something")
    yield _case([9], [1], "a single-digit carry")
    yield _case([9, 9, 9], [1], "a carry that ripples the whole length")
    yield _case([9] * 50, [9] * 50, "two long runs of nines")
    yield _case([1, 2, 3], [4], "very different lengths")

    for n, m in ((2, 2), (5, 3), (12, 12), (40, 7)):
        yield _case(_number(rng, n), _number(rng, m))

    for _ in range(3):
        n = rng.randint(200, 900)
        m = rng.randint(200, 900)
        yield _case(_number(rng, n), _number(rng, m))

    yield _case(
        [9] * (10**4),
        [1],
        "the stated maximum, with a carry through every digit",
    )
    yield _case(_number(rng, 10**4), _number(rng, 10**4), "the stated maximum on both sides")
