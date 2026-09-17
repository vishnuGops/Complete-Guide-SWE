"""Random word lists for anagram-groups.

Builds real groups deliberately - shuffling a base word into several entries -
because random words almost never form a group and would leave the interesting
branch untested.
"""

import random
import string
from typing import Any, Dict, Iterator, List


def _word(rng: random.Random, length: int, alphabet: int) -> str:
    letters = string.ascii_lowercase[:alphabet]
    return "".join(rng.choice(letters) for _ in range(length))


def _shuffled(rng: random.Random, word: str) -> str:
    symbols = list(word)
    rng.shuffle(symbols)
    return "".join(symbols)


def _grouped(rng: random.Random, groups: int, members: int, length: int) -> List[str]:
    words: List[str] = []
    for _ in range(groups):
        base = _word(rng, length, 6)
        for _ in range(rng.randint(1, members)):
            words.append(_shuffled(rng, base))
    rng.shuffle(words)
    return words


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield {"args": [[]], "name": "no words"}
    yield {"args": [["solo"]], "name": "one word, one group"}
    yield {"args": [["", "", "a"]], "name": "empty words group together"}
    yield {"args": [["aab", "aba", "baa", "abb"]], "name": "letter counts matter, not the letter set"}
    yield {"args": [["x", "x", "x"]], "name": "the same word repeated"}
    yield {"args": [["abc", "def", "ghi"]], "name": "every word alone"}

    for groups, members, length in ((2, 3, 3), (5, 2, 4), (8, 4, 5)):
        yield {"args": [_grouped(rng, groups, members, length)]}

    for _ in range(3):
        count = rng.randint(50, 200)
        yield {"args": [[_word(rng, rng.randint(1, 8), rng.randint(2, 26)) for _ in range(count)]]}

    yield {"args": [_grouped(rng, 200, 5, 7)], "name": "many groups"}
    yield {
        "args": [[_word(rng, rng.randint(1, 20), 4) for _ in range(2500)]],
        "name": "maximum size, narrow alphabet",
    }
