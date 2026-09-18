"""Random inputs for coin-ways.

The statement promises the answer fits in a signed 32-bit integer, so the
generator computes it and drops any case that does not - the guarantee is true
by construction rather than by hope. Coin sets that cannot make the amount at
all are included, since zero is a real answer.
"""

import random
from typing import Any, Dict, Iterator, List

LIMIT = 2**31 - 1


def _ways(coins: List[int], amount: int) -> int:
    table = [0] * (amount + 1)
    table[0] = 1
    for coin in coins:
        for total in range(coin, amount + 1):
            table[total] += table[total - coin]
            if table[total] > LIMIT:
                return LIMIT + 1
    return table[amount]


def _case(coins: List[int], amount: int, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [coins, amount]}
    if name:
        case["name"] = name
    return case


def _safe(coins: List[int], amount: int) -> bool:
    return _ways(coins, amount) <= LIMIT


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([1], 0, "making nothing")
    yield _case([2], 3, "no way at all")
    yield _case([1, 2, 5], 5, "four ways to make five")
    yield _case([1000], 1000, "the extremes of the stated ranges")
    yield _case([3, 5, 7], 2, "every coin is larger than the amount")
    yield _case([1], 500, "one coin, one way")

    for count, high, amount in ((2, 10, 20), (3, 25, 60), (5, 50, 120), (4, 100, 300)):
        coins = rng.sample(range(1, high + 1), count)
        if _safe(coins, amount):
            yield _case(coins, amount)
        target = rng.randint(0, 1000)
        if _safe(coins, target):
            yield _case(coins, target)

    # Large coins against a large amount: few ways, and the table is full length.
    for _ in range(3):
        coins = rng.sample(range(200, 1001), rng.randint(3, 12))
        yield _case(coins, rng.randint(500, 1000))

    # The stated maxima, chosen so the count stays inside a 32-bit integer.
    for count in (12, 16, 20):
        for _ in range(8):
            coins = rng.sample(range(50, 1001), count)
            if _safe(coins, 1000):
                yield _case(coins, 1000, "the stated maxima with %d coins" % count)
                break
