"""Random inputs for pair-sum-index.

Every generated case is checked to have exactly one valid pair before it is
yielded, because the statement promises that and both references rely on it.
"""

import random
from typing import Any, Dict, Iterator, List


def _pair_count(values: List[int], target: int) -> int:
    count = 0
    for i in range(len(values)):
        for j in range(i + 1, len(values)):
            if values[i] + values[j] == target:
                count += 1
    return count


def _unique_case_at_scale(rng: random.Random, n: int) -> Dict[str, Any]:
    """A case of `n` values with exactly one valid pair, built in O(n).

    `_unique_case` below rejects and retries with a quadratic check, which is
    why this problem's largest hidden test used to be a thousand values while
    the statement promised 10^5 - and so the quadratic solution the editorial
    says will time out passed comfortably (ROADMAP D21, P6-0).

    Constructed rather than searched. Every filler is strictly greater than
    `target / 2`, so no two fillers can sum to the target; the planted pair is
    `x` and `target - x`, both outside the filler range, so the only pair that
    sums to the target is that one. No search, no retry, one pass.
    """
    target = 0
    x = -rng.randint(1, 10**9 // 2)
    y = target - x  # = -x, which is positive and excluded from the fillers

    fillers = set()
    while len(fillers) < n - 2:
        value = rng.randint(1, 10**9)
        if value != y:
            fillers.add(value)

    values = list(fillers)
    rng.shuffle(values)
    # Planted at two random positions, so the answer is not always at the ends.
    first, second = sorted(rng.sample(range(n), 2))
    values.insert(first, x)
    values.insert(second, y)

    return {"args": [values, target]}


def _unique_case(rng: random.Random, n: int, lo: int, hi: int) -> Dict[str, Any]:
    while True:
        values = [rng.randint(lo, hi) for _ in range(n)]
        i, j = rng.sample(range(n), 2)
        target = values[i] + values[j]
        if _pair_count(values, target) == 1:
            return {"args": [values, target]}


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield {"args": [[4, 9], 13], "name": "smallest possible input"}
    yield {"args": [[-8, -3, 5, 11], -11], "name": "negative values"}
    yield {"args": [[7, 7, 2], 14], "name": "the pair is a repeated value"}
    yield {"args": [[0, 0, 3], 0], "name": "zeros pair with each other"}
    yield {"args": [[10, 1, 2, 3, 4], 14], "name": "answer spans the whole array"}

    for n in (2, 3, 5, 12, 40):
        yield _unique_case(rng, n, -50, 50)
    for _ in range(4):
        yield _unique_case(rng, rng.randint(50, 200), -10**6, 10**6)

    # The stated maximum, which is the only size at which the quadratic
    # solution the editorial warns about actually times out (D21).
    yield {
        **_unique_case_at_scale(rng, 10**5),
        "name": "the stated maximum, where a quadratic scan cannot finish",
    }
