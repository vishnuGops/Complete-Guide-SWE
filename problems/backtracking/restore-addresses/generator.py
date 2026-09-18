"""Random inputs for restore-addresses.

Half the cases are built by writing a real address and dropping its dots, so an
answer exists; the rest are random digit strings, most of which have none. Zeroes
and the 255 boundary are over-represented because they are the two rules that go
wrong.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(digits: str, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [digits]}
    if name:
        case["name"] = name
    return case


def _address(rng: random.Random, pool: List[int]) -> str:
    return "".join(str(rng.choice(pool)) for _ in range(4))


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case("0", "one digit")
    yield _case("1", "one digit, not zero")
    yield _case("0000", "all zeroes")
    yield _case("00000", "five zeroes, which cannot work")
    yield _case("255255255255", "the largest numbers, twelve digits")
    yield _case("25525511135", "two possible addresses")
    yield _case("1111111111111", "too many digits")
    yield _case("256256256256", "every number one too large")
    yield _case("101023", "zeroes in the middle")

    for pool in ([0, 1, 9], [0, 10, 99], [100, 255, 256], [0, 255], list(range(0, 256, 37))):
        for _ in range(2):
            yield _case(_address(rng, pool))

    for length in (4, 6, 9, 12):
        yield _case("".join(rng.choice("0123456789") for _ in range(length)))
        yield _case("".join(rng.choice("0125") for _ in range(length)))

    yield _case("9" * 12, "twelve nines, all over the limit")
    yield _case("2" * 12, "twelve twos")
    yield _case("".join(rng.choice("0123456789") for _ in range(20)), "the stated maximum")
