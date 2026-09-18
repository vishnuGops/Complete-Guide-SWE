"""Random inputs for shift-right-in-place.

The interesting axis is the relationship between `shift` and `n`: zero, one,
n - 1, exactly n, and far beyond n all exercise different branches of a typical
solution.
"""

import random
from typing import Any, Dict, Iterator


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield {"args": [[9], 0], "name": "single element, no shift"}
    yield {"args": [[9], 7], "name": "single element, shift larger than the row"}
    yield {"args": [[1, 2], 1], "name": "two elements"}
    yield {"args": [[4, 5, 6], 3], "name": "shift equals the length"}
    yield {"args": [[4, 5, 6], 0], "name": "shift of zero"}
    yield {"args": [[-3, -1, 0, 2, 8], 4], "name": "shift of n - 1"}
    yield {"args": [[7, 7, 7, 7], 2], "name": "all values equal"}
    yield {"args": [[1, 2, 3, 4, 5], 1000000000], "name": "shift far beyond the row"}

    for n in (5, 17, 64):
        values = [rng.randint(-1000, 1000) for _ in range(n)]
        yield {"args": [values, rng.randint(0, 3 * n)]}

    for _ in range(3):
        n = rng.randint(100, 500)
        values = [rng.randint(-10**9, 10**9) for _ in range(n)]
        yield {"args": [values, rng.randint(0, 10**9)]}

    # The stated maximum (D21, P6-0). This problem's trap is space rather than
    # time - an O(n) copy passes any size - so the statement was lowered to
    # 10^4 to match what a reviewable tests.json can carry, and the largest case
    # now reaches it.
    n = 10**4
    yield {
        "args": [[rng.randint(-(10**9), 10**9) for _ in range(n)], rng.randint(0, 10**9)],
        "name": "the stated maximum",
    }
