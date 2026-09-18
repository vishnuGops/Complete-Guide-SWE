"""Random inputs for letter-arrangements.

Every digit appears somewhere, and the four-letter digits 7 and 9 are
over-represented because a keypad written from memory usually gets those two
wrong.
"""

import random
from typing import Any, Dict, Iterator


def _case(digits: str, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [digits]}
    if name:
        case["name"] = name
    return case


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case("", "no digits")
    yield _case("2", "one digit with three letters")
    yield _case("7", "one digit with four letters")
    yield _case("9", "the other four-letter digit")
    yield _case("23", "two digits")
    yield _case("79", "both four-letter digits")
    yield _case("2345", "four different digits")
    yield _case("22", "the same digit twice")

    for length in (1, 2, 3, 4):
        yield _case("".join(rng.choice("23456789") for _ in range(length)))
        yield _case("".join(rng.choice("79") for _ in range(length)))

    yield _case("234567", "six different digits")
    yield _case("777777", "the stated maximum, all fours")
    yield _case("999999", "the stated maximum, the widest possible")
    yield _case("".join(rng.choice("23456789") for _ in range(6)), "the stated maximum")
