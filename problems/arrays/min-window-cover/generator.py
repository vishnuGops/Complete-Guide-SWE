"""Random inputs for min-window-cover.

Covering windows are rare in a uniformly random log over 26 letters, so most
cases draw from a small alphabet. The shapes that matter: no cover at all, the
whole log as the only cover, a tie broken by the earlier start, and needs with
repeated letters, which is what separates a quota from a set.
"""

import random
import string
from typing import Any, Dict, Iterator, List

SMALL = "abcde"


def _case(log: str, need: str, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [log, need]}
    if name:
        case["name"] = name
    return case


def _text(rng: random.Random, n: int, alphabet: str) -> str:
    return "".join(rng.choice(alphabet) for _ in range(n))


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case("a", "a", "the shortest possible log")
    yield _case("a", "b", "a single letter that is not the one needed")
    yield _case("ab", "abc", "the need is longer than the log")
    yield _case("aaaa", "aaa", "a quota of three from a run of four")
    yield _case("abcabc", "abc", "two stretches of equal length, so the earlier wins")
    yield _case("zzzzabczzzz", "cba", "the order of the need does not matter")

    for n, alphabet, m in ((12, "abc", 2), (40, SMALL, 3), (90, SMALL, 5), (200, "ab", 4)):
        yield _case(_text(rng, n, alphabet), _text(rng, m, alphabet))

    # A need over the full alphabet against a log that does not contain it all.
    yield _case(_text(rng, 300, SMALL), _text(rng, 6, string.ascii_lowercase), "usually uncoverable")

    for _ in range(2):
        n = rng.randint(500, 1500)
        yield _case(_text(rng, n, SMALL), _text(rng, rng.randint(4, 40), SMALL))

    # The stated maxima, where checking every stretch cannot finish.
    yield _case(
        _text(rng, 10**4, SMALL),
        _text(rng, 100, SMALL),
        "the stated maximum log and need",
    )
