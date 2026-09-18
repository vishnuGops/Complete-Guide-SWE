"""Random inputs for split-into-palindromes.

Words over two or three letters produce many palindromic pieces; words over a
wide alphabet produce almost none, so the only cutting is into single letters.
Both are generated, along with the worst case - a word of one repeated letter,
where every one of the 2^(n-1) cuttings is valid.
"""

import random
from typing import Any, Dict, Iterator


def _case(word: str, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [word]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case("a", "one letter")
    yield _case("aa", "two equal letters")
    yield _case("ab", "two different letters")
    yield _case("aab", "two cuttings")
    yield _case("abc", "only single letters")
    yield _case("aba", "the whole word reads the same")
    yield _case("abba", "an even palindrome")
    yield _case("abacaba", "palindromes inside palindromes")

    for n, alphabet in ((4, "ab"), (6, "ab"), (7, "abc"), (9, "abc"), (10, "abcdef")):
        yield _case("".join(rng.choice(alphabet) for _ in range(n)))
        yield _case("".join(rng.choice(alphabet) for _ in range(n)))

    yield _case("a" * 8, "eight equal letters")
    yield _case("a" * 12, "twelve equal letters")
    yield _case("a" * 14, "the stated maximum, all equal - every cutting is valid")
    yield _case("abcdefghijklmn", "the stated maximum, all different")
    yield _case("".join(rng.choice("abc") for _ in range(14)), "the stated maximum")
