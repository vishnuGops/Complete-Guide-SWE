"""Random inputs for insert-one-window.

Schedules are built sorted and merged, as the statement promises, by walking
forward and leaving a gap of at least one between windows. The new window is
then chosen to land before everything, after everything, inside one window,
across several, or exactly touching a boundary.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(schedule: List[List[int]], added: List[int], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [schedule, added]}
    if name:
        case["name"] = name
    return case


def _schedule(rng: random.Random, n: int, gap: int, length: int) -> List[List[int]]:
    out: List[List[int]] = []
    at = rng.randint(0, 5)
    for _ in range(n):
        start = at + rng.randint(1, gap)
        end = start + rng.randint(0, length)
        out.append([start, end])
        at = end
    return out


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([], [4, 8], "an empty schedule")
    yield _case([[1, 5]], [1, 5], "the new window is already there")
    yield _case([[1, 9]], [3, 4], "the new window sits inside an existing one")
    yield _case([[5, 6]], [0, 1], "the new window lands before everything")
    yield _case([[5, 6]], [8, 9], "the new window lands after everything")
    yield _case([[0, 0]], [0, 10**9], "the extremes of the stated range")
    yield _case([[1, 2], [4, 5], [7, 8]], [2, 7], "the new window swallows all three")

    for n, gap, length in ((3, 4, 3), (10, 6, 4), (40, 5, 3), (120, 3, 2)):
        schedule = _schedule(rng, n, gap, length)
        span = schedule[-1][1]
        low = rng.randint(0, span)
        yield _case(schedule, [low, low + rng.randint(0, span // 2 + 1)])

    # A new window that touches a boundary exactly.
    schedule = _schedule(rng, 20, 5, 3)
    boundary = schedule[len(schedule) // 2][1]
    yield _case(schedule, [boundary, boundary + 2], "touching an existing end exactly")

    for _ in range(2):
        schedule = _schedule(rng, rng.randint(300, 800), 40, 20)
        low = rng.randint(0, schedule[-1][1])
        yield _case(schedule, [low, low + rng.randint(0, 5000)])

    # The stated maximum, with a new window that spans the entire schedule.
    schedule = _schedule(rng, 10**4, 40, 20)
    yield _case(schedule, [0, schedule[-1][1]], "the stated maximum, swallowed whole")
