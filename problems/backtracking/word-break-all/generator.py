"""Random inputs for word-break-all.

Half the cases are built by writing a sentence from a small dictionary and then
removing the spaces, so readings exist; the rest are letters that almost work -
the shape where an unmemoised search does exponential work to find nothing.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(letters: str, dictionary: List[str], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [letters, dictionary]}
    if name:
        case["name"] = name
    return case


WORDS = ["cat", "cats", "and", "sand", "dog", "do", "go", "an", "d", "s"]


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case("a", ["a"], "one letter, one word")
    yield _case("a", ["b"], "one letter, the wrong word")
    yield _case("abc", ["ab"], "no reading at all")
    yield _case("aaa", ["a", "aa"], "three readings of three letters")
    yield _case("catsanddog", ["cat", "cats", "and", "sand", "dog"], "two readings")
    yield _case("aaaaaa", ["a"], "one reading, six words long")
    yield _case("abcd", ["a", "abc", "b", "cd", "bcd"], "several cuts that meet up again")

    for length, pool in ((5, 2), (8, 3), (11, 3), (14, 4)):
        alphabet = "abcd"[:pool]
        dictionary = list({"".join(rng.choice(alphabet) for _ in range(rng.randint(1, 3)))
                           for _ in range(rng.randint(3, 8))})
        sentence = "".join(rng.choice(dictionary) for _ in range(rng.randint(2, 5)))
        yield _case(sentence[:20], dictionary)
        yield _case("".join(rng.choice(alphabet) for _ in range(length)), dictionary)

    # The shape the trap is about: many ways to split a prefix, and nothing
    # spells the last letter.
    yield _case("a" * 19 + "b", ["a", "aa"], "nineteen a's and a b, which no reading reaches")
    yield _case("a" * 20, ["a", "aa"], "twenty a's, where the readings really are many")
    # Fourteen rather than twenty over three word lengths: T(20) is about a
    # hundred and twenty thousand readings, which is megabytes of answer.
    yield _case("a" * 14, ["a", "aa", "aaa"], "fourteen a's over three word lengths")
    yield _case("catsanddogcatsanddog"[:20], WORDS, "the stated maximum length")
