from typing import List


class Solution:
    def distinctSubsets(self, values: List[int]) -> List[List[int]]:
        ordered = sorted(values)
        out: List[List[int]] = []
        chosen: List[int] = []

        def build(start: int) -> None:
            out.append(list(chosen))
            for index in range(start, len(ordered)):
                # Only the first of a run of equal values may be entered here.
                if index > start and ordered[index] == ordered[index - 1]:
                    continue
                chosen.append(ordered[index])
                build(index + 1)
                chosen.pop()

        build(0)
        return out
