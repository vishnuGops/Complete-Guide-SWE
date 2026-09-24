"""Random inputs for word-ladder.

Random words are almost never one letter apart, so most lists are built by
walking a ladder first and then padding it with decoys - which guarantees a
route exists and makes its length known to be short. A few cases leave the
target out entirely.
"""

import random
import string
from typing import Any, Dict, Iterator, List


def _case(start: str, target: str, words: List[str], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [start, target, words]}
    if name:
        case["name"] = name
    return case


def _word(rng: random.Random, length: int, alphabet: str) -> str:
    return "".join(rng.choice(alphabet) for _ in range(length))


def _ladder(rng: random.Random, length: int, steps: int, alphabet: str) -> List[str]:
    """A chain of words each one letter from the last, all distinct."""
    seen = set()
    word = _word(rng, length, alphabet)
    chain = [word]
    seen.add(word)
    for _ in range(steps):
        for _ in range(30):
            at = rng.randrange(length)
            letters = list(word)
            letters[at] = rng.choice(alphabet)
            candidate = "".join(letters)
            if candidate not in seen:
                word = candidate
                seen.add(word)
                chain.append(word)
                break
    return chain


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case("ab", "ab", ["ab"], "the start is the target")
    yield _case("a", "b", ["b"], "one letter, one step")
    yield _case("a", "b", ["c"], "the target is missing")
    yield _case("bed", "cot", ["bad", "bat", "cat", "cot", "bet", "bot"], "a ladder of four")
    yield _case("bed", "cot", ["bad", "bat", "cat", "bet", "bot"], "the target is not in the list")
    yield _case("aa", "bb", ["ab", "bb"], "two steps through a shared letter")
    yield _case("aa", "bb", ["bb"], "no rung in between")

    for length, steps, alphabet in ((2, 3, "abc"), (3, 5, "abcd"), (4, 8, "abcde"), (5, 12, "abcdef")):
        chain = _ladder(rng, length, steps, alphabet)
        decoys = [_word(rng, length, alphabet) for _ in range(20)]
        words = list(dict.fromkeys(chain[1:] + decoys))
        yield _case(chain[0], chain[-1], words)
        # The same list with the target removed.
        without = [w for w in words if w != chain[-1]]
        yield _case(chain[0], chain[-1], without)

    # Every word of a small alphabet, so the graph is dense.
    words = ["".join((a, b, c)) for a in "abc" for b in "abc" for c in "abc"]
    yield _case("aaa", "ccc", words, "every three-letter word over three letters")

    for _ in range(2):
        chain = _ladder(rng, 6, 30, "abcdefgh")
        decoys = [_word(rng, 6, "abcdefgh") for _ in range(800)]
        words = list(dict.fromkeys(chain[1:] + decoys))
        yield _case(chain[0], chain[-1], words)

    # Close to the stated maxima: five thousand words of length ten.
    chain = _ladder(rng, 10, 60, "abcdefghij")
    decoys = [_word(rng, 10, "abcdefghij") for _ in range(5000)]
    words = list(dict.fromkeys(chain[1:] + decoys))[:5000]
    if chain[-1] not in words:
        words[-1] = chain[-1]
    yield _case(chain[0], chain[-1], words, "the stated maxima, the worst case for comparing every pair")
