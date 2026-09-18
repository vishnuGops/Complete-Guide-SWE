"""Random inputs for regex-match.

Patterns are built from units - a letter or a dot, optionally starred - so every
one is well formed, and half of them are built to match a text that is then
handed over, so both answers occur. The exponential shape (`a*` repeated against
a run of a's) is included explicitly.
"""

import random
from typing import Any, Dict, Iterator, List, Tuple


def _case(text: str, pattern: str, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [text, pattern]}
    if name:
        case["name"] = name
    return case


def _pattern(rng: random.Random, units: int, alphabet: str) -> str:
    out: List[str] = []
    for _ in range(units):
        part = "." if rng.random() < 0.25 else rng.choice(alphabet)
        out.append(part + "*" if rng.random() < 0.45 else part)
    return "".join(out)


def _matching(rng: random.Random, pattern: str, alphabet: str) -> str:
    """A text the pattern matches, built by walking its units."""
    out: List[str] = []
    at = 0
    while at < len(pattern):
        part = pattern[at]
        starred = at + 1 < len(pattern) and pattern[at + 1] == "*"
        times = rng.randint(0, 3) if starred else 1
        for _ in range(times):
            out.append(rng.choice(alphabet) if part == "." else part)
        at += 2 if starred else 1
    return "".join(out)[:20]


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case("", "a*", "an empty text and a star")
    yield _case("", "a", "an empty text and a letter")
    yield _case("a", "a", "one letter")
    yield _case("a", ".", "a dot")
    yield _case("aa", "a", "the whole text must match")
    yield _case("aab", "c*a*b", "a star matching nothing")
    yield _case("ab", ".*", "any run of anything")
    yield _case("mississippi", "mis*is*p*.", "a pattern that almost matches")
    yield _case("aaa", "a*a", "a star and then the same letter")
    yield _case("", "a*b*c*", "an empty text and three stars")

    for units, alphabet in ((2, "ab"), (4, "ab"), (6, "abc"), (8, "abc")):
        for _ in range(2):
            pattern = _pattern(rng, units, alphabet)
            if len(pattern) <= 30:
                yield _case(_matching(rng, pattern, alphabet), pattern)
                yield _case("".join(rng.choice(alphabet) for _ in range(rng.randint(0, 10))), pattern)

    # The shape an unmemoised matcher cannot finish.
    yield _case("a" * 20, "a*" * 10, "twenty a's against ten stars")
    yield _case("a" * 19 + "b", "a*" * 10, "the same, with a letter that cannot match")
    yield _case("a" * 20, ".*" * 10, "twenty a's against ten dotted stars")
    yield _case("abcabcabcabcabcabcab", "a*b*c*a*b*c*.*.*.*.*", "the stated maxima")
