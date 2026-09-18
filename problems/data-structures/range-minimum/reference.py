from typing import List


class MinTable:
    def __init__(self, readings: List[int]) -> None:
        self._n = len(readings)
        # Leaves at n .. 2n-1; the parent of i is i // 2.
        self._tree = [0] * (2 * self._n)
        for index, value in enumerate(readings):
            self._tree[self._n + index] = value
        for index in range(self._n - 1, 0, -1):
            self._tree[index] = min(self._tree[2 * index], self._tree[2 * index + 1])

    def set(self, at: int, value: int) -> None:
        index = at + self._n
        self._tree[index] = value
        # Only the path to the root is affected, and all of it is.
        index //= 2
        while index >= 1:
            self._tree[index] = min(self._tree[2 * index], self._tree[2 * index + 1])
            index //= 2

    def smallest(self, start: int, end: int) -> int:
        best = None
        left = start + self._n
        right = end + self._n + 1      # half-open

        while left < right:
            if left & 1:
                # A right-hand child: take it, it cannot be absorbed upwards.
                best = self._tree[left] if best is None else min(best, self._tree[left])
                left += 1
            if right & 1:
                right -= 1
                best = self._tree[right] if best is None else min(best, self._tree[right])
            left //= 2
            right //= 2

        return best
