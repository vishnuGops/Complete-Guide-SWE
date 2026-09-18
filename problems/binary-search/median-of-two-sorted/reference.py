from typing import List


class Solution:
    def medianOfTwo(self, first: List[int], second: List[int]) -> float:
        # Search over the shorter series, so that j stays inside [0, m].
        if len(first) > len(second):
            first, second = second, first

        n = len(first)
        m = len(second)
        total = n + m
        half = (total + 1) // 2

        low = 0
        high = n
        while low <= high:
            i = low + (high - low) // 2
            j = half - i

            left_first = first[i - 1] if i > 0 else float("-inf")
            right_first = first[i] if i < n else float("inf")
            left_second = second[j - 1] if j > 0 else float("-inf")
            right_second = second[j] if j < m else float("inf")

            if left_first <= right_second and left_second <= right_first:
                if total % 2 == 1:
                    return float(max(left_first, left_second))
                return (max(left_first, left_second) + min(right_first, right_second)) / 2
            if left_first > right_second:
                high = i - 1
            else:
                low = i + 1

        # Unreachable while both series are sorted.
        raise ValueError("the series are not sorted")
