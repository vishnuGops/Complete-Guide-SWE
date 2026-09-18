from typing import List


class Solution:
    def bitsUpTo(self, n: int) -> List[int]:
        answer = [0] * (n + 1)
        for value in range(1, n + 1):
            # `value & (value - 1)` is `value` with its lowest set bit removed,
            # and is therefore smaller and already answered.
            answer[value] = answer[value & (value - 1)] + 1
        return answer
