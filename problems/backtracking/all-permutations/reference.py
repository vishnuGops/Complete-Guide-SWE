from typing import List


class Solution:
    def everyOrdering(self, values: List[int]) -> List[List[int]]:
        out: List[List[int]] = []
        chosen: List[int] = []
        used = [False] * len(values)

        def build() -> None:
            if len(chosen) == len(values):
                out.append(list(chosen))
                return
            for index in range(len(values)):
                if used[index]:
                    continue
                used[index] = True
                chosen.append(values[index])
                build()
                chosen.pop()
                used[index] = False

        build()
        return out
