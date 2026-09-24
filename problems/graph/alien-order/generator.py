"""Random inputs for alien-order.

Most dictionaries are built forwards: pick a random order of some letters, write
random words, and sort them by that order - so a consistent answer exists by
construction. The rest are random word lists, which almost always contradict
themselves, plus the prefix case built explicitly.
"""

import random
import string
from typing import Any, Dict, Iterator, List


def _case(words: List[str], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [words]}
    if name:
        case["name"] = name
    return case


def _dictionary(rng: random.Random, letters: int, count: int, length: int) -> List[str]:
    """Words sorted by a random alphabet, so an order exists by construction."""
    alphabet = list(string.ascii_lowercase[:letters])
    rng.shuffle(alphabet)
    rank = {letter: index for index, letter in enumerate(alphabet)}
    words = []
    for _ in range(count):
        words.append("".join(rng.choice(alphabet) for _ in range(rng.randint(1, length))))
    words = list(dict.fromkeys(words))
    words.sort(key=lambda word: [rank[letter] for letter in word])
    return words


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case(["a"], "one word of one letter")
    yield _case(["ab"], "one word, two letters, in an unknown order")
    yield _case(["n", "m"], "one fact")
    yield _case(["k", "h", "k"], "a contradiction")
    yield _case(["abc", "ab"], "a word before its own prefix")
    yield _case(["ab", "abc"], "a prefix before its word, which is fine")
    yield _case(["sq", "sw", "qw", "qe", "ej"], "five words, five letters")
    yield _case(["ba", "bc", "ac"], "facts from two positions")

    for letters, count, length in ((3, 6, 3), (5, 15, 4), (8, 40, 5), (12, 120, 6)):
        yield _case(_dictionary(rng, letters, count, length))
        # A random list in our own order, which usually contradicts itself.
        words = sorted({"".join(rng.choice(string.ascii_lowercase[:letters])
                                for _ in range(rng.randint(1, length)))
                        for _ in range(count)})
        yield _case(words)

    # Every letter present but almost no constraints.
    yield _case(sorted(string.ascii_lowercase), "every letter, one per word, in our own order")

    for _ in range(2):
        yield _case(_dictionary(rng, 26, rng.randint(200, 600), 12))

    yield _case(_dictionary(rng, 26, 1000, 20), "the stated maxima")
