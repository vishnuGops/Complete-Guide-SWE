"""Random inputs for longest-palindrome-run.

Even-length palindromes are over-represented, because a solution that only
expands from letters misses them entirely. Words over one or two letters give
the quadratic worst case, and words over the full alphabet give runs of one.
"""

import random
import string
from typing import Any, Dict, Iterator


def _case(word: str, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [word]}
    if name:
        case["name"] = name
    return case


def _word(rng: random.Random, n: int, alphabet: str) -> str:
    return "".join(rng.choice(alphabet) for _ in range(n))


def _with_palindrome(rng: random.Random, n: int, core: int, alphabet: str) -> str:
    half = _word(rng, core // 2, alphabet)
    middle = _word(rng, core % 2, alphabet)
    piece = half + middle + half[::-1]
    before = _word(rng, rng.randint(0, max(0, n - len(piece))), alphabet)
    after = _word(rng, max(0, n - len(piece) - len(before)), alphabet)
    return before + piece + after


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case("a", "one letter")
    yield _case("ab", "two different letters")
    yield _case("aa", "two equal letters")
    yield _case("abc", "nothing longer than a letter")
    yield _case("babad", "a tie broken by position")
    yield _case("cbbd", "an even palindrome")
    yield _case("abacdfgdcaba", "two palindromes of equal length")
    yield _case("aaaa", "every substring is a palindrome")

    for n, alphabet in ((6, "ab"), (12, "abc"), (30, "abcd"), (80, string.ascii_lowercase)):
        yield _case(_word(rng, n, alphabet))
        yield _case(_with_palindrome(rng, n, rng.randint(3, max(3, n // 2)), alphabet))

    yield _case("a" * 500, "five hundred equal letters")
    yield _case(_word(rng, 500, "ab"), "five hundred over two letters")

    yield _case("a" * 1000, "the stated maximum, all equal")
    yield _case(_word(rng, 1000, string.ascii_lowercase), "the stated maximum over the full alphabet")
    yield _case(_with_palindrome(rng, 1000, 400, "abcde"), "the stated maximum with a long palindrome inside")
