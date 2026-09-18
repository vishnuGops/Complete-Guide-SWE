"""Random inputs for is-palindrome-chain.

Palindromes are vanishingly rare at random, so half the cases are built as
palindromes and half of those are then broken at one position - often in the
middle, which is where an off-by-one in the comparison shows up.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(values: List[int], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [values]}
    if name:
        case["name"] = name
    return case


def _palindrome(rng: random.Random, n: int, pool: int = 3) -> List[int]:
    half = [rng.randint(0, pool) for _ in range(n // 2)]
    middle = [rng.randint(0, pool)] if n % 2 == 1 else []
    return half + middle + half[::-1]


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([], "the empty chain")
    yield _case([1], "a single link")
    yield _case([1, 1], "two equal links")
    yield _case([1, 2], "two different links")
    yield _case([1, 2, 1], "an odd palindrome")
    yield _case([1, 2, 2, 1], "an even palindrome")
    yield _case([-(10**9), 10**9, -(10**9)], "the extremes of the stated range")

    for n in (5, 6, 21, 40):
        yield _case(_palindrome(rng, n))
        broken = _palindrome(rng, n)
        at = rng.randrange(n)
        broken[at] = broken[at] + 1
        yield _case(broken)

    # The middle link of an odd chain has no partner, so changing only it
    # leaves the chain a palindrome - which a comparison that walks one pair too
    # far gets wrong.
    values = _palindrome(rng, 41)
    values[20] += 1000
    yield _case(values, "the middle link is unlike its neighbours, and it still reads the same")

    for _ in range(2):
        n = rng.randint(500, 2000)
        yield _case(_palindrome(rng, n, pool=9))

    yield _case(_palindrome(rng, 10**4, pool=50), "the stated maximum, a palindrome")
