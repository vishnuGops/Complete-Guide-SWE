"""Random inputs for accounts-merge.

People are built first - a name and a pool of addresses - and then cut into
several accounts that overlap by at least one address, so merging is genuinely
required. Names are drawn from a small pool so that two different people sharing
a name is common, which is the case a name-based merge gets wrong.
"""

import random
from typing import Any, Dict, Iterator, List

NAMES = ["ann", "bob", "cat", "dan", "eve"]


def _case(accounts: List[List[str]], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [accounts]}
    if name:
        case["name"] = name
    return case


def _people(rng: random.Random, people: int, addresses: int, pieces: int) -> List[List[str]]:
    accounts: List[List[str]] = []
    for person in range(people):
        name = rng.choice(NAMES)
        owned = ["m%d_%d" % (person, i) for i in range(addresses)]
        rng.shuffle(owned)
        # Cut into overlapping pieces, each sharing its first address with the
        # person's first address, so the whole person is one group.
        for piece in range(pieces):
            chosen = rng.sample(owned, rng.randint(1, max(1, len(owned) // 2)))
            if owned[0] not in chosen:
                chosen.append(owned[0])
            accounts.append([name] + chosen)
    rng.shuffle(accounts)
    return accounts


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([["ann", "a1"]], "one account")
    yield _case([["dan", "d1"], ["dan", "d1"]], "the same account twice")
    yield _case([["bob", "b1"], ["cat", "c1"]], "nothing to merge")
    yield _case([["ann", "a1", "a2"], ["ann", "a3"], ["ann", "a2", "a4"]], "two of three accounts merge")
    yield _case([["ann", "a1"], ["ann", "a2"]], "the same name, nothing shared")
    # Every account of a person carries that person's name, as the statement
    # requires - so a chain of shared addresses is a chain within one name. An
    # address shared between two *different* names would leave the merged name
    # undefined, which is what that constraint exists to prevent.
    yield _case([["ann", "a1", "a2"], ["ann", "a2", "a3"], ["ann", "a3", "a4"]],
                "a chain of shared addresses")

    for people, addresses, pieces in ((2, 3, 2), (4, 5, 3), (8, 4, 2), (20, 6, 3)):
        yield _case(_people(rng, people, addresses, pieces))

    # Every account shares one address, so everything is one person.
    yield _case([["ann", "shared", "x%d" % i] for i in range(50)], "fifty accounts, all one person")

    # Nothing shared at all, so nothing merges.
    yield _case([["bob", "u%d" % i] for i in range(50)], "fifty separate people")

    for _ in range(2):
        yield _case(_people(rng, rng.randint(30, 80), rng.randint(3, 6), 3))

    # The stated maxima: a thousand accounts, and five thousand addresses
    # between them.
    yield _case(_people(rng, 500, 4, 2), "the stated maximum number of accounts")
    yield _case([["ann", "shared"] + ["z%d" % (person * 4 + i) for i in range(4)]
                 for person in range(1000)],
                "the stated maxima, every account one person")
