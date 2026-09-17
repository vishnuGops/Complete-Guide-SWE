"""Random messages for first-unique-symbol.

Narrow alphabets make repeats likely and wide ones make them rare, so both the
answer and the -1 branch get exercised.
"""

import random
import string
from typing import Any, Dict, Iterator


def _message(rng: random.Random, n: int, alphabet: int) -> str:
    letters = string.ascii_lowercase[:alphabet]
    return "".join(rng.choice(letters) for _ in range(n))


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield {"args": [""], "name": "empty message"}
    yield {"args": ["a"], "name": "one letter"}
    yield {"args": ["aa"], "name": "one letter twice"}
    yield {"args": ["abcdefghijklmnopqrstuvwxyz"], "name": "every letter once"}
    yield {"args": ["aabbccddz"], "name": "the answer is the last letter"}
    yield {"args": ["zaabbcc"], "name": "the answer is the first letter"}
    yield {"args": ["aaaaaaaaaa"], "name": "one letter repeated"}

    for n in (2, 6, 30, 120):
        yield {"args": [_message(rng, n, rng.randint(1, 26))]}

    for _ in range(3):
        n = rng.randint(400, 1500)
        yield {"args": [_message(rng, n, rng.choice([2, 5, 26]))]}

    yield {"args": [_message(rng, 10000, 26)], "name": "maximum size"}
