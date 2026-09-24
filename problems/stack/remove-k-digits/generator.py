"""Random inputs for remove-k-digits.

The shapes that matter: already ascending (nothing is popped and the leftover
removals do all the work), already descending (the prefix is eaten), numbers
full of zeroes (where the leading-zero strip decides the answer), and k equal to
the whole length.
"""

import random
from typing import Any, Dict, Iterator


def _case(digits: str, k: int, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [digits, k]}
    if name:
        case["name"] = name
    return case


def _number(rng: random.Random, length: int, alphabet: str = "0123456789") -> str:
    if length == 1:
        return rng.choice(alphabet)
    first = rng.choice(alphabet.replace("0", "") or "1")
    return first + "".join(rng.choice(alphabet) for _ in range(length - 1))


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case("0", 0, "a single zero, nothing removed")
    yield _case("0", 1, "a single zero, removed")
    yield _case("52", 2, "everything removed")
    yield _case("70400", 1, "a leading zero appears")
    yield _case("12345", 2, "already ascending, so the removals come off the end")
    yield _case("54321", 2, "already descending")
    yield _case("112", 1, "position matters more than size")
    yield _case("100000", 1, "a long run of zeroes behind the leading digit")

    for length in (3, 8, 25, 90):
        digits = _number(rng, length)
        yield _case(digits, rng.randint(0, length))
        yield _case(digits, 1)
        yield _case(digits, length)

    yield _case(_number(rng, 300, "01"), 150, "only zeroes and ones")

    for _ in range(2):
        length = rng.randint(500, 2000)
        yield _case(_number(rng, length), rng.randint(1, length - 1))

    length = 10**4
    yield _case(_number(rng, length), length // 2, "the stated maximum")
    ascending = "".join(str(d) for d in sorted(rng.randint(1, 9) for _ in range(length)))
    yield _case(ascending, len(ascending) // 4, "the stated maximum, already ascending")
