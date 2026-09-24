"""Random inputs for simplify-path.

Paths are assembled from pieces drawn with deliberate weight towards `.`, `..`
and empty separators, plus names that look like dots (`...`, `....`) which are
ordinary folders and are the usual misreading.
"""

import random
from typing import Any, Dict, Iterator, List

NAMES = ["home", "user", "a", "b", "c", "...", "....", "_", "x1", "dir_2", "a.b"]


def _case(path: str, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [path]}
    if name:
        case["name"] = name
    return case


def _path(rng: random.Random, pieces: int) -> str:
    out = []
    for _ in range(pieces):
        out.append(rng.choices(NAMES + [".", ".."], weights=[3] * len(NAMES) + [4, 6])[0])
    separators = ["/" * rng.randint(1, 3) for _ in range(pieces)]
    text = ""
    for separator, piece in zip(separators, out):
        text += separator + piece
    if rng.random() < 0.4:
        text += "/" * rng.randint(1, 2)
    return text if text.startswith("/") else "/" + text


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case("/", "the root itself")
    yield _case("//", "two slashes and nothing else")
    yield _case("/..", "going above the root")
    yield _case("/../../../", "going above the root repeatedly")
    yield _case("/...", "three dots is an ordinary folder")
    yield _case("/a/../a/../a", "the same folder entered and left twice")
    yield _case("/var//log/", "doubled and trailing slashes")
    yield _case("/p/./q/../../r/", "dots and double dots")

    for pieces in (1, 3, 8, 30, 120):
        yield _case(_path(rng, pieces))
        yield _case(_path(rng, pieces))

    # The stated maximum length, built from short pieces.
    text = ""
    while len(text) < 2990:
        text += "/" + rng.choice(NAMES + [".", ".."])
    yield _case(text[:3000], "the stated maximum length")
