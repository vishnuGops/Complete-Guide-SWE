"""Random puzzles for solve-the-grid.

Each puzzle is built the only honest way: start from a complete valid grid,
remove clues one at a time, and keep a removal only while the puzzle still has
exactly one filling. The uniqueness check is a solution counter that stops at
two, so the statement's guarantee is true by construction rather than by hope.
"""

import random
from typing import Any, Dict, Iterator, List


def _case(grid: List[List[int]], name: str = None) -> Dict[str, Any]:
    case: Dict[str, Any] = {"args": [grid]}
    if name:
        case["name"] = name
    return case


def _complete(rng: random.Random) -> List[List[int]]:
    """A complete valid grid, from the standard pattern with everything shuffled."""
    rows = list(range(3))
    band_order = rng.sample(rows, 3)
    stack_order = rng.sample(rows, 3)
    row_order = [band * 3 + r for band in band_order for r in rng.sample(rows, 3)]
    column_order = [stack * 3 + c for stack in stack_order for c in rng.sample(rows, 3)]
    digits = rng.sample(range(1, 10), 9)

    def pattern(row: int, column: int) -> int:
        return (3 * (row % 3) + row // 3 + column) % 9

    return [[digits[pattern(r, c)] for c in column_order] for r in row_order]


def _count_solutions(grid: List[List[int]], cap: int = 2) -> int:
    """How many fillings the grid has, stopping once `cap` is reached."""
    row_used = [0] * 9
    column_used = [0] * 9
    box_used = [0] * 9
    blanks = []
    for row in range(9):
        for column in range(9):
            digit = grid[row][column]
            if digit == 0:
                blanks.append((row, column))
            else:
                bit = 1 << digit
                row_used[row] |= bit
                column_used[column] |= bit
                box_used[(row // 3) * 3 + column // 3] |= bit

    found = 0

    def solve(at: int) -> None:
        nonlocal found
        if found >= cap:
            return
        if at == len(blanks):
            found += 1
            return
        # Most constrained blank first, which keeps the counter quick.
        best = at
        best_free = 10
        for index in range(at, len(blanks)):
            row, column = blanks[index]
            box = (row // 3) * 3 + column // 3
            used = row_used[row] | column_used[column] | box_used[box]
            free = sum(1 for d in range(1, 10) if not used & (1 << d))
            if free < best_free:
                best_free = free
                best = index
                if free <= 1:
                    break
        blanks[at], blanks[best] = blanks[best], blanks[at]

        row, column = blanks[at]
        box = (row // 3) * 3 + column // 3
        for digit in range(1, 10):
            bit = 1 << digit
            if (row_used[row] | column_used[column] | box_used[box]) & bit:
                continue
            row_used[row] |= bit
            column_used[column] |= bit
            box_used[box] |= bit
            solve(at + 1)
            row_used[row] &= ~bit
            column_used[column] &= ~bit
            box_used[box] &= ~bit
            if found >= cap:
                break

        blanks[at], blanks[best] = blanks[best], blanks[at]

    solve(0)
    return found


def _puzzle(rng: random.Random, wanted_blanks: int) -> List[List[int]]:
    """A grid with about `wanted_blanks` blanks and exactly one filling."""
    grid = _complete(rng)
    cells = [(r, c) for r in range(9) for c in range(9)]
    rng.shuffle(cells)
    removed = 0
    for row, column in cells:
        if removed >= wanted_blanks:
            break
        saved = grid[row][column]
        grid[row][column] = 0
        if _count_solutions(grid) == 1:
            removed += 1
        else:
            grid[row][column] = saved
    return grid


def generate(rng: random.Random) -> Iterator[Dict[str, Any]]:
    complete = _complete(rng)
    yield _case([row[:] for row in complete], "nothing to fill")

    one_blank = [row[:] for row in complete]
    one_blank[4][4] = 0
    yield _case(one_blank, "one blank")

    a_row = [row[:] for row in complete]
    for column in range(9):
        a_row[0][column] = 0
    yield _case(a_row, "a whole row blank")

    a_box = [row[:] for row in complete]
    for row in range(3, 6):
        for column in range(3, 6):
            a_box[row][column] = 0
    yield _case(a_box, "a whole box blank")

    for blanks in (5, 12, 20, 30, 38, 45):
        yield _case(_puzzle(rng, blanks))

    for _ in range(4):
        yield _case(_puzzle(rng, rng.randint(25, 50)))

    yield _case(_puzzle(rng, 55), "as few clues as the removal could reach")
