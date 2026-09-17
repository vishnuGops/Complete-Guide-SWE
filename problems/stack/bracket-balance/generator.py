"""Bracket fragments for bracket-balance.

Balanced fragments are built recursively and then damaged in specific ways -
swapping a kind, dropping a closer, adding a stray closer - because random
bracket soup is almost always unbalanced for the same boring reason.
"""

import random
from typing import Any, Dict, Iterator, List

PAIRS = ["()", "[]", "{}"]


def _balanced(rng: random.Random, pairs: int) -> str:
    out: List[str] = []
    open_stack: List[str] = []
    remaining = pairs
    while remaining > 0 or open_stack:
        if remaining > 0 and (not open_stack or rng.random() < 0.55):
            pair = rng.choice(PAIRS)
            out.append(pair[0])
            open_stack.append(pair[1])
            remaining -= 1
        else:
            out.append(open_stack.pop())
    return "".join(out)


def _damaged(rng: random.Random, text: str) -> str:
    if not text:
        return ")"
    how = rng.randrange(3)
    position = rng.randrange(len(text))
    if how == 0:
        replacement = rng.choice("()[]{}")
        return text[:position] + replacement + text[position + 1:]
    if how == 1:
        return text[:position] + text[position + 1:]
    return text + rng.choice(")]}")


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield {"args": [""], "name": "empty fragment"}
    yield {"args": ["()"], "name": "one pair"}
    yield {"args": [")("], "name": "closed before opened"}
    yield {"args": ["((("], "name": "never closed"}
    yield {"args": ["([)]"], "name": "interleaved, not nested"}
    yield {"args": ["{[()]}"], "name": "three kinds nested"}
    yield {"args": ["()()()"], "name": "sequential pairs"}

    for pairs in (2, 5, 20):
        yield {"args": [_balanced(rng, pairs)]}
        yield {"args": [_damaged(rng, _balanced(rng, pairs))]}

    for _ in range(2):
        yield {"args": [_balanced(rng, rng.randint(200, 900))]}

    yield {"args": [_balanced(rng, 5000)], "name": "maximum size, balanced"}
    yield {"args": ["(" * 10000], "name": "maximum size, all opening"}
