from typing import List


class SumTable:
    def __init__(self, readings: List[int]) -> None:
        self._values = list(readings)
        # One longer, because the walk uses `at & -at` and that is 0 at index 0.
        self._tree = [0] * (len(readings) + 1)
        for index, value in enumerate(readings):
            self._add(index + 1, value)

    def set(self, at: int, value: int) -> None:
        # The tree stores sums, so what is added is the difference.
        self._add(at + 1, value - self._values[at])
        self._values[at] = value

    def total(self, start: int, end: int) -> int:
        return self._prefix(end + 1) - self._prefix(start)

    def _add(self, at: int, delta: int) -> None:
        while at < len(self._tree):
            self._tree[at] += delta
            at += at & -at

    def _prefix(self, at: int) -> int:
        running = 0
        while at > 0:
            running += self._tree[at]
            at -= at & -at
        return running
