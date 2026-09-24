"""Random inputs for decode-ways.

Zeroes are over-represented, because every rule this problem has is about them.
Strings of ones and twos give the largest counts, and a string of ones at the
stated maximum is exactly the Fibonacci ceiling the bound was chosen for.
"""

import random
from typing import Any, Dict, Iterator


def _case(digits: str, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [digits]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case("0", "a single zero")
    yield _case("1", "a single digit")
    yield _case("09", "a leading zero")
    yield _case("10", "a zero that must pair up")
    yield _case("20", "the other zero that can pair up")
    yield _case("30", "a zero that cannot pair up")
    yield _case("118", "three readings")
    yield _case("2101", "zeroes in the middle")
    yield _case("27", "a pair that is too large")
    yield _case("100", "two zeroes in a row")

    for length, alphabet in ((3, "12"), (6, "0126"), (12, "123456789"), (20, "0123456789"), (30, "12")):
        for _ in range(2):
            yield _case("".join(rng.choice(alphabet) for _ in range(length)))

    yield _case("1" * 20, "twenty ones")
    yield _case("1" * 45, "the stated maximum, all ones - the largest possible count")
    yield _case("".join(rng.choice("0123456789") for _ in range(45)), "the stated maximum")
    yield _case("12" * 22 + "1", "the stated maximum, alternating")
