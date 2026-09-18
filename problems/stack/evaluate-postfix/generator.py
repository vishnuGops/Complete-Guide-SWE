"""Random inputs for evaluate-postfix.

Lines are built by growing a random expression tree and writing it postfix, so
every case is valid by construction. Divisors are never zero and negative
operands are common, because truncation towards zero is where the two languages
disagree.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(tokens: List[str], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [tokens]}
    if name:
        case["name"] = name
    return case


def _combine(left: int, operator: str, right: int) -> int:
    if operator == "+":
        return left + right
    if operator == "-":
        return left - right
    if operator == "*":
        return left * right
    magnitude = abs(left) // abs(right)
    return magnitude if (left < 0) == (right < 0) else -magnitude


def _safe(rng: random.Random, leaves: int) -> List[str]:
    """A postfix line of `leaves` operands whose every intermediate fits in an
    int32 and which never divides by zero.

    Built left-deep and incrementally rather than as a random tree: a random
    tree deep enough to reach the stated maximum overflows both the recursion
    limit and the 32-bit bound long before it is finished.
    """
    first = rng.randint(-200, 200)
    tokens = [str(first)]
    value = first

    for _ in range(leaves - 1):
        operand = rng.randint(-200, 200)
        choices = ["+", "-", "+", "-"]
        if abs(value) <= 10**6 and operand != 0:
            choices.append("*")
        if operand != 0:
            choices.append("/")
        operator = rng.choice(choices)
        candidate = _combine(value, operator, operand)
        if candidate > 2**31 - 1 or candidate < -(2**31):
            operator = "-"
            candidate = _combine(value, operator, operand)
        tokens.append(str(operand))
        tokens.append(operator)
        value = candidate

    return tokens


def _nested(rng: random.Random, leaves: int) -> List[str]:
    """A random tree shape, for the small cases where the depth is harmless."""
    if leaves == 1:
        return [str(rng.randint(-9, 9))]
    left_leaves = rng.randint(1, leaves - 1)
    left = _nested(rng, left_leaves)
    right = _nested(rng, leaves - left_leaves)
    return left + right + [rng.choice(["+", "-", "*"])]


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case(["7"], "a single operand")
    yield _case(["0"], "a single zero")
    yield _case(["3", "4", "+"], "one addition")
    yield _case(["3", "4", "-"], "subtraction, where the pop order matters")
    yield _case(["-7", "2", "/"], "truncation towards zero")
    yield _case(["7", "-2", "/"], "a negative divisor")
    yield _case(["-200", "-200", "*"], "the extremes of the stated operand range")

    for leaves in (2, 3, 6, 15, 40):
        yield _case(_safe(rng, leaves))
        yield _case(_nested(rng, leaves))

    for _ in range(2):
        yield _case(_safe(rng, rng.randint(200, 800)))

    # The stated maximum: 10^4 tokens is 5000 operands and 4999 operators plus
    # one spare, so 5000 leaves lands just under it.
    yield _case(_safe(rng, 5000), "close to the stated maximum")
