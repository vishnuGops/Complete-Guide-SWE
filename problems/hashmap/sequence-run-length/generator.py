"""Random ticket piles for sequence-run-length.

Half the cases plant a long run inside noise, because uniformly random values
over a wide range almost never contain a run worth finding.
"""

import random
from typing import Any, Dict, Iterator, List


def _with_run(rng: random.Random, noise: int, run: int, span: int) -> List[int]:
    start = rng.randint(-span, span)
    values = [start + offset for offset in range(run)]
    values += [rng.randint(-span, span) for _ in range(noise)]
    rng.shuffle(values)
    return values


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield {"args": [[]], "name": "empty pile"}
    yield {"args": [[5]], "name": "one number"}
    yield {"args": [[5, 5, 5, 5]], "name": "one number repeated"}
    yield {"args": [[1, 2, 3, 4, 5, 6]], "name": "the whole pile is one run"}
    yield {"args": [[10, 30, 50, 70]], "name": "no two numbers adjacent"}
    yield {"args": [[-2, -1, 0, 1, 5]], "name": "run crosses zero"}
    yield {"args": [[10**9 - 1, 10**9, -(10**9)]], "name": "extreme values"}

    for noise, run in ((5, 3), (20, 8), (60, 15)):
        yield {"args": [_with_run(rng, noise, run, 500)]}

    for _ in range(3):
        n = rng.randint(200, 900)
        span = rng.choice([50, 10**4, 10**9])
        yield {"args": [[rng.randint(-span, span) for _ in range(n)]]}

    yield {"args": [list(range(10000))], "name": "maximum size, one long run"}
    yield {"args": [_with_run(rng, 6000, 4000, 10**9)], "name": "maximum size, run in noise"}
