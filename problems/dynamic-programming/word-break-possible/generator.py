"""Random inputs for word-break-possible.

Half the cases are sentences with their spaces removed, so a reading exists; the
rest are letters that almost work - the shape where an unmemoised search does
exponential work to find nothing.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(letters: str, dictionary: List[str], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [letters, dictionary]}
    if name:
        case["name"] = name
    return case


def _dictionary(rng: random.Random, count: int, alphabet: str, longest: int) -> List[str]:
    return list({"".join(rng.choice(alphabet) for _ in range(rng.randint(1, longest)))
                 for _ in range(count)})


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case("a", ["a"], "one letter")
    yield _case("a", ["b"], "one letter, not a word")
    yield _case("applepen", ["apple", "pen"], "two words")
    yield _case("catsandog", ["cats", "dog", "sand", "and", "cat"], "it almost works")
    yield _case("aaaaaaaaaa", ["a"], "one word, ten times")
    yield _case("a" * 30 + "b", ["a", "aa", "aaa"], "thirty a's and a b, which no reading reaches")

    for length, count, alphabet, longest in ((8, 5, "ab", 3), (20, 8, "abc", 4), (60, 20, "abcd", 5)):
        dictionary = _dictionary(rng, count, alphabet, longest)
        sentence = "".join(rng.choice(dictionary) for _ in range(rng.randint(2, 8)))
        yield _case(sentence[:300], dictionary)
        yield _case("".join(rng.choice(alphabet) for _ in range(length)), dictionary)

    # A long sentence that reads, and the same one with a letter changed.
    dictionary = ["ab", "abc", "cd", "d", "abcd"]
    sentence = "".join(rng.choice(dictionary) for _ in range(60))[:300]
    yield _case(sentence, dictionary, "a long sentence that reads")
    broken = sentence[:-1] + "z"
    yield _case(broken, dictionary, "the same sentence with the last letter changed")

    # The stated maxima.
    big = _dictionary(rng, 1000, "abcde", 20)
    yield _case("a" * 299 + "z", ["a", "aa", "aaa"], "the stated maximum length, unreadable")
    yield _case("".join(rng.choice("abcde") for _ in range(300)), big, "the stated maxima")
