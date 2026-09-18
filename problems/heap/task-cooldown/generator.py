"""Random inputs for task-cooldown.

Two shapes decide the answer: one task dominating (the skeleton wins) and many
different tasks (the gaps overflow and the answer is simply the count). Both are
generated deliberately, along with ties for most frequent, which is the term most
often left out.
"""

import random
from typing import Any, Dict, Iterator


def _case(tasks: str, cooldown: int, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [tasks, cooldown]}
    if name:
        case["name"] = name
    return case


def _word(rng: random.Random, n: int, alphabet: str) -> str:
    return "".join(rng.choice(alphabet) for _ in range(n))


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case("a", 0, "a single task, no cooldown")
    yield _case("a", 10**4, "a single task, the largest cooldown")
    yield _case("aabb", 2, "two tasks twice each")
    yield _case("abc", 5, "nothing repeats")
    yield _case("aaa", 2, "one task, three times")
    yield _case("abcdef", 0, "no cooldown at all")
    yield _case("aaabbb", 2, "two tasks tied for most frequent")
    yield _case("aaaaaabcde", 2, "the gaps overflow")

    for n, alphabet, cooldown in (
        (5, "ab", 1),
        (12, "abc", 2),
        (40, "abcd", 3),
        (100, "abcdefgh", 2),
        (200, "ab", 5),
    ):
        yield _case(_word(rng, n, alphabet), cooldown)
        yield _case(_word(rng, n, alphabet), 0)
        yield _case(_word(rng, n, alphabet), rng.randint(1, 50))

    # Every letter equally common, so every one of the 26 is tied.
    yield _case("".join(letter * 40 for letter in "abcdefghijklmnopqrstuvwxyz"), 25,
                "all twenty-six tasks tied")

    for _ in range(2):
        n = rng.randint(1000, 5000)
        yield _case(_word(rng, n, "abcdefghij"), rng.randint(0, 200))

    yield _case("a" * (10**4), 10**4, "the stated maxima, where a tick-by-tick simulation cannot finish")
    yield _case(_word(rng, 10**4, "abcdefghijklmnopqrstuvwxyz"), 25, "the stated maximum, well mixed")
