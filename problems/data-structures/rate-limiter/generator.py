"""Random operation sequences for rate-limiter.

Request times never decrease, as the statement requires. Bursts at a single tick
and requests landing exactly on the window boundary are generated deliberately -
the boundary is where an off-by-one hides, and a burst is where recording
refusals goes wrong.
"""

import random
from typing import Any, Dict, Iterator, List


def _sequence(limit: int, window: int, times: List[int], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {
        "args": [limit, window],
        "ops": [{"method": "allow", "args": [at]} for at in times],
    }
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _sequence(2, 10, [1, 2, 3, 12], "two allowed, one refused, then one more")
    yield _sequence(1, 5, [1, 6], "aging out exactly")
    yield _sequence(1, 5, [1, 5], "one tick too early")
    yield _sequence(1, 5, [1, 1], "two at the same tick")
    yield _sequence(3, 1, [1, 1, 1, 1, 2], "a window of one tick")
    yield _sequence(1, 10**6, [1, 10**9], "the extremes of the stated ranges")
    yield _sequence(2, 10, [1, 1, 1, 1, 1, 1, 100], "a burst of refusals, then one much later")

    for limit, window, count in ((1, 3, 10), (2, 5, 20), (5, 20, 60), (10, 100, 200)):
        at = 1
        times = []
        for _ in range(count):
            times.append(at)
            at += rng.choice([0, 0, 1, 1, 2, window // 2 + 1, window + 1])
        yield _sequence(limit, window, times)

    # Exactly at the boundary, repeatedly.
    times = [1]
    for step in range(1, 40):
        times.append(1 + step * 10)
    yield _sequence(3, 10, times, "every request exactly a window apart")

    at = 1
    times = []
    for _ in range(10**4):
        times.append(at)
        at += rng.randint(0, 3)
    yield _sequence(1000, 10**6, times, "the stated maximum")
