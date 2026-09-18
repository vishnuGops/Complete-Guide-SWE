"""Random operation sequences for wildcard-dictionary.

Patterns are made by blanking letters of words that were added - so they match -
and by blanking letters of words that were not, which usually do not. Dots in
the first position are over-represented, since that is where the branching is
widest.
"""

import random
from typing import Any, Dict, Iterator, List

ALPHABET = "abcd"


def _sequence(ops: List[Dict[str, Any]], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [], "ops": ops}
    if name:
        case["name"] = name
    return case


def _word(rng: random.Random, n: int) -> str:
    return "".join(rng.choice(ALPHABET) for _ in range(n))


def _blanked(rng: random.Random, word: str, dots: int) -> str:
    letters = list(word)
    positions = rng.sample(range(len(word)), min(dots, len(word)))
    for at in positions:
        letters[at] = "."
    return "".join(letters)


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _sequence([{"method": "matches", "args": ["a"]}], "an empty dictionary")
    yield _sequence([{"method": "add", "args": ["a"]}, {"method": "matches", "args": ["."]}],
                    "a single dot")
    yield _sequence([{"method": "add", "args": ["ab"]}, {"method": "matches", "args": ["a"]}],
                    "the lengths differ")
    yield _sequence([
        {"method": "add", "args": ["bad"]},
        {"method": "add", "args": ["dad"]},
        {"method": "add", "args": ["mad"]},
        {"method": "matches", "args": ["pad"]},
        {"method": "matches", "args": ["bad"]},
        {"method": "matches", "args": [".ad"]},
        {"method": "matches", "args": ["b.."]},
    ], "dots in different places")
    yield _sequence([
        {"method": "add", "args": ["ab"]},
        {"method": "matches", "args": ["a."]},
        {"method": "matches", "args": [".b"]},
        {"method": "matches", "args": [".."]},
        {"method": "matches", "args": ["..."]},
    ], "every dot arrangement of one word")
    yield _sequence([
        {"method": "add", "args": ["abc"]},
        {"method": "matches", "args": ["ab"]},
        {"method": "matches", "args": ["ab."]},
    ], "a prefix is not a match")

    for count, length in ((3, 2), (5, 3), (8, 3), (12, 4), (25, 4), (40, 5), (100, 6)):
        words = [_word(rng, length) for _ in range(count)]
        ops: List[Dict[str, Any]] = [{"method": "add", "args": [w]} for w in words]
        for _ in range(max(6, count // 2)):
            if rng.random() < 0.5:
                pattern = _blanked(rng, rng.choice(words), rng.randint(0, 3))
            else:
                pattern = _blanked(rng, _word(rng, length), rng.randint(0, 3))
            ops.append({"method": "matches", "args": [pattern]})
        yield _sequence(ops)

    # Dots at the front, where the branching is widest.
    words = [_word(rng, 8) for _ in range(150)]
    ops = [{"method": "add", "args": [w]} for w in words]
    ops += [{"method": "matches", "args": "..." + rng.choice(words)[3:]} for _ in range(0)]
    ops += [{"method": "matches", "args": ["..." + rng.choice(words)[3:]]} for _ in range(30)]
    yield _sequence(ops, "three dots at the front of a long word")

    words = [_word(rng, rng.randint(1, 20)) for _ in range(500)]
    ops = [{"method": "add", "args": [w]} for w in words]
    for _ in range(1400):
        base = rng.choice(words)
        ops.append({"method": "matches", "args": [_blanked(rng, base, rng.randint(0, 3))]})
    yield _sequence(ops, "the stated maximum")
