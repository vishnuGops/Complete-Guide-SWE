"""Random inputs for fewest-coins.

Coin systems where greed is wrong are generated deliberately - the [1, 3, 4]
shape, and larger versions of it - alongside ordinary systems where it happens
to be right, and systems that cannot make the amount at all.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(coins: List[int], amount: int, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [coins, amount]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([1], 0, "making nothing")
    yield _case([2], 3, "no combination works")
    yield _case([1, 2, 5], 11, "three coins make eleven")
    yield _case([1, 3, 4], 6, "greed gets it wrong")
    yield _case([1, 7, 10], 14, "greed gets it wrong again")
    yield _case([10**4], 10**4, "the extremes of the stated ranges")
    yield _case([3, 5, 7], 2, "every coin is larger than the amount")
    yield _case([1, 2, 5, 10, 20, 50, 100, 200], 9999, "an ordinary coin system")

    for count, high, amount in ((2, 15, 40), (4, 40, 150), (6, 200, 900), (8, 2000, 6000)):
        coins = rng.sample(range(1, high + 1), count)
        yield _case(coins, amount)
        yield _case(coins, rng.randint(0, 10**4))

    # Coins with no 1, so many amounts are unreachable.
    for _ in range(3):
        coins = rng.sample(range(2, 500), rng.randint(3, 8))
        yield _case(coins, rng.randint(1, 10**4))

    yield _case(rng.sample(range(1, 10**4), 12), 10**4, "the stated maxima")
    yield _case([1] + rng.sample(range(2, 10**4), 11), 10**4, "the stated maxima, always reachable")
