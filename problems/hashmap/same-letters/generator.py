"""Random inputs for same-letters.

Random words almost never match, so most matching cases are built by shuffling.
The shapes that matter: equal lengths with one letter swapped, the same letters
at different multiplicities, and single-letter words.
"""

import random
from typing import Any, Dict, Iterator


def _case(first: str, second: str, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [first, second]}
    if name:
        case["name"] = name
    return case


def _shuffled(rng: random.Random, word: str) -> str:
    letters = list(word)
    rng.shuffle(letters)
    return "".join(letters)


def _word(rng: random.Random, n: int, alphabet: str = "abcdefghij") -> str:
    return "".join(rng.choice(alphabet) for _ in range(n))


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case("a", "a", "one letter, matching")
    yield _case("a", "b", "one letter, not matching")
    yield _case("aab", "aba", "a repeat, rearranged")
    yield _case("aab", "abb", "the same letters at different multiplicities")
    yield _case("ab", "abc", "the second word is longer")
    yield _case("zyx", "xyz", "the far end of the alphabet")

    for n in (4, 9, 26, 80):
        word = _word(rng, n)
        yield _case(word, _shuffled(rng, word))
        yield _case(word, _word(rng, n))

    # Two long words over a single letter, differing by one position.
    long_word = _word(rng, 2000, "ab")
    yield _case(long_word, _shuffled(rng, long_word), "two thousand letters, rearranged")

    maximum = _word(rng, 10**4, "abcdefghijklmnopqrstuvwxyz")
    yield _case(maximum, _shuffled(rng, maximum), "the stated maximum, rearranged")
    yield _case(maximum, maximum[:-1] + ("a" if maximum[-1] != "a" else "b"), "the stated maximum, off by one letter")
