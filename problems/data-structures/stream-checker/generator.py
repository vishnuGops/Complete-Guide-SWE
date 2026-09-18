"""Random operation sequences for stream-checker.

Streams are built from a small alphabet so that matches actually happen, and
half the word lists are drawn as substrings of the stream itself - a list of
unrelated words would answer false at every letter and test nothing.
"""

import random
from typing import Any, Dict, Iterator, List

ALPHABET = "abc"


def _sequence(words: List[str], stream: str, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {
        "args": [words],
        "ops": [{"method": "next", "args": [letter]} for letter in stream],
    }
    if name:
        case["name"] = name
    return case


def _stream(rng: random.Random, n: int) -> str:
    return "".join(rng.choice(ALPHABET) for _ in range(n))


def _words_from(rng: random.Random, text: str, count: int, longest: int) -> List[str]:
    out = set()
    while len(out) < count and len(text) > 1:
        length = rng.randint(1, min(longest, len(text)))
        start = rng.randrange(len(text) - length + 1)
        out.add(text[start:start + length])
    return sorted(out)


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _sequence(["cd", "f", "kl"], "abcdefghijkl", "three words in a stream of twelve letters")
    yield _sequence(["a"], "ba", "a single letter word")
    yield _sequence(["ab"], "a", "half a word")
    yield _sequence(["ab"], "aab", "the word completed after a false start")
    yield _sequence(["aaa"], "aaaa", "overlapping matches")
    yield _sequence(["abc", "bc", "c"], "abc", "three words ending at the same letter")
    yield _sequence(["z"], "aaaaa", "a word that never arrives")

    for stream_length, count, longest in ((10, 3, 3), (30, 6, 4), (80, 12, 5), (200, 30, 8)):
        text = _stream(rng, stream_length)
        yield _sequence(_words_from(rng, text, count, longest), text)
        yield _sequence([_stream(rng, rng.randint(1, longest)) for _ in range(count)], text)

    # Long words, so the backward walk goes as deep as it can.
    text = _stream(rng, 500)
    yield _sequence(_words_from(rng, text, 50, 20), text, "fifty words of up to twenty letters")

    text = _stream(rng, 4000)
    yield _sequence(_words_from(rng, text, 200, 20), text, "the stated maximum")
