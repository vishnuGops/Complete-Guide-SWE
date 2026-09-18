"""Random inputs for reorganise-string.

Drawn from small alphabets with deliberately lopsided counts, so that both
outcomes happen often: words just inside the ceil(n / 2) bound, words just
outside it, and words of a single repeated letter.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(letters: str, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [letters]}
    if name:
        case["name"] = name
    return case


def _word(rng: random.Random, counts: Dict[str, int]) -> str:
    letters: List[str] = []
    for letter, how_many in counts.items():
        letters.extend([letter] * how_many)
    rng.shuffle(letters)
    return "".join(letters)


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case("a", "a single letter")
    yield _case("aa", "two of the same letter")
    yield _case("ab", "two different letters")
    yield _case("aab", "one letter repeated twice")
    yield _case("aaab", "impossible")
    yield _case("aabb", "two pairs")
    yield _case("aaabbb", "two letters, evenly matched")
    yield _case("aaaabc", "one letter over the bound")

    for n, alphabet in ((5, "ab"), (12, "abc"), (40, "abcd"), (150, "abcdef")):
        yield _case("".join(rng.choice(alphabet) for _ in range(n)))
        # Exactly at the bound: one letter takes ceil(n / 2).
        rest = n - (n + 1) // 2
        counts = {"a": (n + 1) // 2}
        for index in range(rest):
            letter = alphabet[1 + index % (len(alphabet) - 1)]
            counts[letter] = counts.get(letter, 0) + 1
        yield _case(_word(rng, counts))
        # One over the bound, so no arrangement exists.
        counts = {"a": (n + 1) // 2 + 1}
        for index in range(n - counts["a"]):
            letter = alphabet[1 + index % (len(alphabet) - 1)]
            counts[letter] = counts.get(letter, 0) + 1
        yield _case(_word(rng, counts))

    for _ in range(2):
        n = rng.randint(500, 3000)
        yield _case("".join(rng.choice("abcde") for _ in range(n)))

    n = 10**4
    yield _case("".join(rng.choice("abcdefghijklmnopqrstuvwxyz") for _ in range(n)),
                "the stated maximum")
    yield _case("a" * (n // 2) + "".join(rng.choice("bcd") for _ in range(n - n // 2)),
                "the stated maximum, exactly at the bound")
