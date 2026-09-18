from typing import List


class Solution:
    def hasCycle(self, n: int, roads: List[List[int]]) -> bool:
        onwards: List[List[int]] = [[] for _ in range(n)]
        for start, end in roads:
            onwards[start].append(end)

        UNTOUCHED, OPEN, CLOSED = 0, 1, 2
        state = [UNTOUCHED] * n

        for begin in range(n):
            if state[begin] != UNTOUCHED:
                continue
            # Each place is pushed twice: once to enter it, once to leave it.
            stack = [(begin, False)]
            while stack:
                place, leaving = stack.pop()
                if leaving:
                    state[place] = CLOSED
                    continue
                if state[place] == OPEN:
                    continue
                state[place] = OPEN
                stack.append((place, True))
                for other in onwards[place]:
                    if state[other] == OPEN:
                        return True
                    if state[other] == UNTOUCHED:
                        stack.append((other, False))

        return False
