"""Random operation sequences for prefix-tree.

Words are drawn from a small alphabet and built by extending words already
added, so prefixes overlap constantly - a dictionary of unrelated words would
never exercise the distinction between `has` and `startsWith`.
"""

import random
from typing import Any, Dict, Iterator, List

ALPHABET = "abc"


def _sequence(ops: List[Dict[str, Any]], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [], "ops": ops}
    if name:
        case["name"] = name
    return case


def _words(rng: random.Random, count: int, longest: int) -> List[str]:
    """Words that share beginnings, by extending ones already made."""
    out = [""]
    for _ in range(count):
        base = rng.choice(out)
        extra = "".join(rng.choice(ALPHABET) for _ in range(rng.randint(1, 3)))
        word = (base + extra)[:longest]
        if word:
            out.append(word)
    return [w for w in out if w]


def _random_ops(rng: random.Random, words: List[str], count: int) -> List[Dict[str, Any]]:
    ops: List[Dict[str, Any]] = []
    for _ in range(count):
        word = rng.choice(words)
        choice = rng.choices(["add", "has", "startsWith"], weights=[4, 3, 3])[0]
        if choice != "add" and rng.random() < 0.4:
            # Ask about a prefix of a word rather than the word itself.
            word = word[:rng.randint(1, len(word))]
        ops.append({"method": choice, "args": [word]})
    return ops


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _sequence([{"method": "startsWith", "args": ["a"]}], "an empty dictionary")
    yield _sequence([{"method": "has", "args": ["a"]}], "asking an empty dictionary")
    yield _sequence([
        {"method": "add", "args": ["a"]},
        {"method": "has", "args": ["a"]},
        {"method": "startsWith", "args": ["a"]},
    ], "a word is a prefix of itself")
    yield _sequence([
        {"method": "add", "args": ["apple"]},
        {"method": "add", "args": ["apple"]},
        {"method": "has", "args": ["apple"]},
        {"method": "startsWith", "args": ["appl"]},
    ], "the same word twice")
    yield _sequence([
        {"method": "add", "args": ["ab"]},
        {"method": "has", "args": ["abc"]},
        {"method": "startsWith", "args": ["abc"]},
    ], "asking about something longer than anything added")
    yield _sequence([
        {"method": "add", "args": ["abc"]},
        {"method": "add", "args": ["ab"]},
        {"method": "has", "args": ["ab"]},
        {"method": "has", "args": ["abc"]},
        {"method": "has", "args": ["a"]},
    ], "a word that is a prefix of another")

    for words, count in ((6, 20), (15, 60), (40, 200), (100, 600)):
        pool = _words(rng, words, 20)
        yield _sequence(_random_ops(rng, pool, count))

    # Long words sharing a long beginning.
    stem = "".join(rng.choice(ALPHABET) for _ in range(15))
    ops = [{"method": "add", "args": [stem + rng.choice(ALPHABET) * rng.randint(1, 5)]}
           for _ in range(30)]
    ops += [{"method": "startsWith", "args": [stem[:k]]} for k in range(1, 16)]
    ops += [{"method": "has", "args": [stem]}]
    yield _sequence(ops, "thirty words sharing a fifteen-letter beginning")

    pool = _words(rng, 400, 20)
    yield _sequence(_random_ops(rng, pool, 3000), "the stated maximum")
