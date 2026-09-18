"""Random inputs for word-in-grid.

Half the words are traced out on the board first - so they are findable by
construction - and half are drawn at random, which almost always fails. The
pathological case is included explicitly: a board of one repeated letter with a
word that matches until its final character.
"""

import random
import string
from typing import Any, Dict, Iterator, List

LETTERS = "abcd"


def _case(board: List[List[str]], word: str, name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [board, word]}
    if name:
        case["name"] = name
    return case


def _board(rng: random.Random, rows: int, columns: int, alphabet: str) -> List[List[str]]:
    return [[rng.choice(alphabet) for _ in range(columns)] for _ in range(rows)]


def _traced(rng: random.Random, board: List[List[str]], length: int) -> str:
    """A word that is definitely findable: walk a path and read it off."""
    rows = len(board)
    columns = len(board[0])
    row = rng.randrange(rows)
    column = rng.randrange(columns)
    seen = {(row, column)}
    word = board[row][column]
    for _ in range(length - 1):
        options = [
            (row + dr, column + dc)
            for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1))
            if 0 <= row + dr < rows and 0 <= column + dc < columns
            and (row + dr, column + dc) not in seen
        ]
        if not options:
            break
        row, column = rng.choice(options)
        seen.add((row, column))
        word += board[row][column]
    return word


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    yield _case([["a"]], "a", "one cell, one letter")
    yield _case([["a"]], "b", "one cell, the wrong letter")
    yield _case([["a"]], "aa", "the word is longer than the board")
    yield _case([["a", "b"], ["c", "d"]], "abdc", "a path around three cells")
    yield _case([["a", "b"], ["c", "d"]], "abad", "a cell would have to be reused")
    yield _case([["a", "a"], ["a", "a"]], "aaaa", "every cell the same letter")
    yield _case([["a", "b", "c"]], "abc", "a single row")
    yield _case([["a"], ["b"], ["c"]], "cba", "a single column, backwards")

    for rows, columns in ((2, 3), (3, 3), (4, 4), (6, 6), (1, 6), (6, 1)):
        board = _board(rng, rows, columns, LETTERS)
        yield _case([row[:] for row in board], _traced(rng, board, rng.randint(2, min(10, rows * columns))))
        yield _case(
            [row[:] for row in board],
            "".join(rng.choice(LETTERS) for _ in range(rng.randint(3, 8))),
        )

    # The pathological shape: one repeated letter, and a word that matches all
    # the way to its final character.
    yield _case([["a"] * 6 for _ in range(6)], "a" * 14 + "b",
                "the stated maxima, where an unpruned search explores every path")
    yield _case([["a"] * 6 for _ in range(6)], "a" * 15, "the stated maxima, findable")
    yield _case([["a"] * 5 + ["b"] for _ in range(6)], "b" + "a" * 14,
                "the rare letter is at the start of the word")
