from typing import Dict, List, Tuple


class SparseReadings:
    def __init__(self) -> None:
        # name -> the non-zero entries, sorted by position.
        self._rows: Dict[str, List[Tuple[int, int]]] = {}

    def add(self, name: str, values: List[int]) -> None:
        self._rows[name] = [
            (position, value) for position, value in enumerate(values) if value != 0
        ]

    def dot(self, first: str, second: str) -> int:
        left = self._rows.get(first, [])
        right = self._rows.get(second, [])

        total = 0
        i = 0
        j = 0
        while i < len(left) and j < len(right):
            if left[i][0] == right[j][0]:
                total += left[i][1] * right[j][1]
                i += 1
                j += 1
            elif left[i][0] < right[j][0]:
                i += 1
            else:
                j += 1
        return total

    def nonZeroCount(self, name: str) -> int:
        return len(self._rows.get(name, []))
