from typing import List


class Solution:
    def chooseK(self, n: int, k: int) -> List[List[int]]:
        out: List[List[int]] = []
        chosen: List[int] = []

        def build(start: int) -> None:
            if len(chosen) == k:
                out.append(list(chosen))
                return
            # Leave enough numbers behind to finish the choice.
            last = n - (k - len(chosen)) + 1
            for value in range(start, last + 1):
                chosen.append(value)
                build(value + 1)
                chosen.pop()

        build(1)
        return out
