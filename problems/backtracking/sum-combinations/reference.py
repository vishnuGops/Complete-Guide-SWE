from typing import List


class Solution:
    def waysToTotal(self, values: List[int], target: int) -> List[List[int]]:
        ordered = sorted(values)
        out: List[List[int]] = []
        chosen: List[int] = []

        def build(start: int, remaining: int) -> None:
            if remaining == 0:
                out.append(list(chosen))
                return
            for index in range(start, len(ordered)):
                value = ordered[index]
                if value > remaining:
                    # Sorted, so nothing later in the loop fits either.
                    break
                chosen.append(value)
                # `index`, not `index + 1`: a value may be used again.
                build(index, remaining - value)
                chosen.pop()

        build(0, target)
        return out
