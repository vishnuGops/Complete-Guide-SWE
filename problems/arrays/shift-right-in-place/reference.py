from typing import List


class Solution:
    def shiftRight(self, values: List[int], shift: int) -> None:
        n = len(values)
        if n == 0:
            return
        shift %= n
        if shift == 0:
            return
        self._reverse(values, 0, n - 1)
        self._reverse(values, 0, shift - 1)
        self._reverse(values, shift, n - 1)

    def _reverse(self, values: List[int], lo: int, hi: int) -> None:
        while lo < hi:
            values[lo], values[hi] = values[hi], values[lo]
            lo += 1
            hi -= 1
