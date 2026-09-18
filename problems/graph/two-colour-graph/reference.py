from collections import deque
from typing import List


class Solution:
    def twoColourable(self, n: int, dislikes: List[List[int]]) -> bool:
        against: List[List[int]] = [[] for _ in range(n)]
        for a, b in dislikes:
            against[a].append(b)
            against[b].append(a)

        # 0 unassigned, 1 and -1 the two rooms.
        room = [0] * n

        for start in range(n):
            if room[start] != 0:
                continue
            room[start] = 1
            queue = deque([start])
            while queue:
                person = queue.popleft()
                for other in against[person]:
                    if room[other] == 0:
                        room[other] = -room[person]
                        queue.append(other)
                    elif room[other] == room[person]:
                        return False

        return True
