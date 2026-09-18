"""Random inputs for decode-repeated.

Shorthands are built recursively so that nesting, multi-digit counts and runs of
plain letters all occur, and every one is well-formed by construction. The
expanded length is checked against the stated 10^5 bound before a case is
yielded.
"""

import random
import string
from typing import Any, Dict, Iterator, Tuple

LETTERS = "abcde"


def _case(shorthand: str, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [shorthand]}
    if name:
        case["name"] = name
    return case


def _build(rng: random.Random, budget: int) -> Tuple[str, int]:
    """A shorthand and the length it expands to, within `budget` characters."""
    pieces = []
    expanded = 0
    for _ in range(rng.randint(1, 3)):
        if rng.random() < 0.45 and budget > expanded + 4:
            count = rng.randint(1, 12)
            inner, inner_length = _build(rng, max(1, (budget - expanded) // count))
            if inner_length * count + expanded > budget:
                continue
            pieces.append(str(count) + "[" + inner + "]")
            expanded += inner_length * count
        else:
            run = "".join(rng.choice(LETTERS) for _ in range(rng.randint(1, 4)))
            if expanded + len(run) > budget:
                continue
            pieces.append(run)
            expanded += len(run)
    if not pieces:
        return LETTERS[0], 1
    return "".join(pieces), expanded


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case("a", "a single letter")
    yield _case("abc", "nothing to expand")
    yield _case("1[a]", "a count of one")
    yield _case("3[a]2[bc]", "two runs side by side")
    yield _case("2[a3[b]]", "nested counts")
    yield _case("12[a]", "a two-digit count")
    yield _case("2[a]3[b]", "the count must reset between runs")
    yield _case("2[2[2[2[a]]]]", "four levels of nesting")
    yield _case("300[a]", "the largest allowed count")

    for budget in (10, 60, 400, 5000):
        for _ in range(2):
            shorthand, _length = _build(rng, budget)
            if len(shorthand) <= 100:
                yield _case(shorthand)

    # A short shorthand with a very long answer: 300 * 3^5 * 2 = 145800 is over
    # the bound, so four levels rather than five.
    yield _case("300[" + "3[" * 4 + "ab" + "]" * 4 + "]", "a short shorthand with a very long answer")

    # Exactly the stated maximum length: twelve blocks of seven characters is 84,
    # and a sixteen-letter run brings it to 100.
    longest = "9[abcd]" * 12 + "abcdefghijklmnop"
    assert len(longest) == 100
    yield _case(longest, "the stated maximum shorthand length")
