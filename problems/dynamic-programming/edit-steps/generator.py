"""Random inputs for edit-steps.

Pairs are built by taking a word and applying a known number of edits, so the
answer is bounded above by something the generator knows - and by drawing wholly
unrelated words, where the answer is close to the longer length. Empty strings
appear on both sides, since the base row and column are what this problem tests.
"""

import random
import string
from typing import Any, Dict, Iterator


def _case(start: str, into: str, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [start, into]}
    if name:
        case["name"] = name
    return case


def _word(rng: random.Random, n: int, alphabet: str) -> str:
    return "".join(rng.choice(alphabet) for _ in range(n))


def _edited(rng: random.Random, word: str, edits: int, alphabet: str, longest: int = 500) -> str:
    letters = list(word)
    for _ in range(edits):
        kind = rng.choice(["insert", "delete", "replace"])
        # An insert at the stated maximum length becomes a replacement, so the
        # edited word stays inside the constraint.
        if kind == "insert" and len(letters) >= longest:
            kind = "replace"
        if kind == "insert" or not letters:
            letters.insert(rng.randint(0, len(letters)), rng.choice(alphabet))
        elif kind == "delete":
            del letters[rng.randrange(len(letters))]
        else:
            letters[rng.randrange(len(letters))] = rng.choice(alphabet)
    return "".join(letters)


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case("", "", "both empty")
    yield _case("", "abc", "from nothing")
    yield _case("abc", "", "into nothing")
    yield _case("abc", "abc", "already equal")
    yield _case("a", "b", "one replacement")
    yield _case("plated", "pad", "three edits")
    yield _case("shoreline", "shortlist", "two nine-letter words")

    for n, alphabet, edits in ((5, "ab", 2), (12, "abc", 4), (30, "abcde", 10), (60, string.ascii_lowercase, 20)):
        word = _word(rng, n, alphabet)
        yield _case(word, _edited(rng, word, edits, alphabet))
        yield _case(word, _word(rng, n, alphabet))

    yield _case("a" * 100, "b" * 100, "a hundred replacements")
    yield _case("a" * 100, "a" * 50, "fifty deletions")

    big = _word(rng, 500, string.ascii_lowercase)
    yield _case(big, _edited(rng, big, 80, string.ascii_lowercase), "the stated maxima, eighty edits apart")
    yield _case(big, _word(rng, 500, string.ascii_lowercase), "the stated maxima, unrelated")
    yield _case(_word(rng, 500, "ab"), _word(rng, 500, "ab"), "the stated maxima over two letters")
    yield _case("", _word(rng, 500, "abc"), "the stated maximum from nothing")
