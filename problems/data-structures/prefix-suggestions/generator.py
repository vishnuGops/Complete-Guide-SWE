"""Random operation sequences for prefix-suggestions.

Words share beginnings by construction, and several sequences add far more than
three words under one prefix, which is where the early stop and the alphabetical
order both matter.
"""

import random
from typing import Any, Dict, Iterator, List

ALPHABET = "abc"


def _sequence(ops: List[Dict[str, Any]], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [], "ops": ops}
    if name:
        case["name"] = name
    return case


def _words(rng: random.Random, count: int, stem: str) -> List[str]:
    out = []
    for _ in range(count):
        extra = "".join(rng.choice(ALPHABET) for _ in range(rng.randint(1, 5)))
        out.append((stem + extra)[:20])
    return out


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _sequence([{"method": "suggest", "args": ["z"]}], "nothing matches")
    yield _sequence([
        {"method": "add", "args": ["mouse"]},
        {"method": "add", "args": ["mousepad"]},
        {"method": "add", "args": ["mobile"]},
        {"method": "suggest", "args": ["mo"]},
    ], "three matching words")
    yield _sequence([
        {"method": "add", "args": ["mouse"]},
        {"method": "add", "args": ["mousepad"]},
        {"method": "add", "args": ["mobile"]},
        {"method": "add", "args": ["moon"]},
        {"method": "suggest", "args": ["mo"]},
    ], "more than three match")
    yield _sequence([
        {"method": "add", "args": ["ab"]},
        {"method": "suggest", "args": ["ab"]},
        {"method": "suggest", "args": ["a"]},
        {"method": "suggest", "args": ["abc"]},
    ], "the prefix is itself a word")
    yield _sequence([
        {"method": "add", "args": ["a"]},
        {"method": "add", "args": ["a"]},
        {"method": "suggest", "args": ["a"]},
    ], "the same word twice")
    yield _sequence([
        {"method": "add", "args": ["b"]},
        {"method": "add", "args": ["a"]},
        {"method": "add", "args": ["c"]},
        {"method": "suggest", "args": ["a"]},
        {"method": "suggest", "args": ["b"]},
    ], "words added out of alphabetical order")

    for count, stem in ((3, "b"), (4, "a"), (7, "ab"), (10, "ab"), (18, "c"), (30, "a"), (80, "")):
        words = _words(rng, count, stem)
        ops: List[Dict[str, Any]] = [{"method": "add", "args": [w]} for w in words]
        for _ in range(max(5, count // 2)):
            word = rng.choice(words)
            ops.append({"method": "suggest", "args": [word[:rng.randint(1, len(word))]]})
        yield _sequence(ops)

    # Many words under one prefix, so the early stop does real work.
    words = _words(rng, 200, "abc")
    ops = [{"method": "add", "args": [w]} for w in words]
    ops += [{"method": "suggest", "args": ["abc"]} for _ in range(20)]
    ops += [{"method": "suggest", "args": ["ab"]}, {"method": "suggest", "args": ["a"]}]
    yield _sequence(ops, "two hundred words under one prefix")

    words = _words(rng, 600, "")
    ops = [{"method": "add", "args": [w]} for w in words]
    for _ in range(1400):
        word = rng.choice(words)
        ops.append({"method": "suggest", "args": [word[:rng.randint(1, len(word))]]})
    yield _sequence(ops, "the stated maximum")
