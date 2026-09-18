from typing import List


class Solution:
    def everySubset(self, values: List[int]) -> List[List[int]]:
        out: List[List[int]] = []
        chosen: List[int] = []

        def build(at: int) -> None:
            if at == len(values):
                out.append(list(chosen))
                return
            build(at + 1)
            chosen.append(values[at])
            build(at + 1)
            chosen.pop()

        build(0)
        return out
