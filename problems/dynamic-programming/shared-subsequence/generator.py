"""Random inputs for shared-subsequence.

Words over small alphabets share a great deal and words over the full alphabet
share almost nothing, so both are generated. Pairs built by interleaving a common
core with noise give a known-large answer without the generator having to
compute it.
"""

import random
import string
from typing import Any, Dict, Iterator


def _case(first: str, second: str, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [first, second]}
    if name:
        case["name"] = name
    return case


def _word(rng: random.Random, n: int, alphabet: str) -> str:
    return "".join(rng.choice(alphabet) for _ in range(n))


def _with_core(rng: random.Random, core: str, extra: int, alphabet: str) -> str:
    letters = list(core)
    for _ in range(extra):
        letters.insert(rng.randint(0, len(letters)), rng.choice(alphabet))
    return "".join(letters)


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case("a", "a", "one letter, shared")
    yield _case("a", "b", "one letter, not shared")
    yield _case("abc", "abc", "identical words")
    yield _case("abc", "def", "nothing shared")
    yield _case("abcde", "ace", "three letters shared")
    yield _case("abc", "cba", "the same letters, reversed")
    yield _case("aaaa", "aa", "one letter repeated")

    for n, m, alphabet in ((4, 6, "ab"), (10, 8, "abc"), (30, 25, "abcde"), (60, 60, string.ascii_lowercase)):
        yield _case(_word(rng, n, alphabet), _word(rng, m, alphabet))
        core = _word(rng, min(n, m) // 2, alphabet)
        yield _case(_with_core(rng, core, n // 2, alphabet), _with_core(rng, core, m // 2, alphabet))

    yield _case("a" * 200, "a" * 300, "two long runs of one letter")
    yield _case(_word(rng, 400, "ab"), _word(rng, 400, "ab"), "four hundred over two letters")

    yield _case(_word(rng, 1000, string.ascii_lowercase), _word(rng, 1000, string.ascii_lowercase),
                "the stated maxima over the full alphabet")
    yield _case(_word(rng, 1000, "abc"), _word(rng, 1000, "abc"),
                "the stated maxima over three letters")
    yield _case("a" * 1000, "a" * 1000, "the stated maxima, identical")
