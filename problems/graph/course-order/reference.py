import heapq
from typing import List


class Solution:
    def courseOrder(self, n: int, rules: List[List[int]]) -> List[int]:
        unlocks: List[List[int]] = [[] for _ in range(n)]
        waiting = [0] * n
        for before, after in rules:
            unlocks[before].append(after)
            waiting[after] += 1

        # A heap, not a queue: the answer must be the smallest valid order.
        available = [course for course in range(n) if waiting[course] == 0]
        heapq.heapify(available)

        order: List[int] = []
        while available:
            course = heapq.heappop(available)
            order.append(course)
            for unlocked in unlocks[course]:
                waiting[unlocked] -= 1
                if waiting[unlocked] == 0:
                    heapq.heappush(available, unlocked)

        # Anything left still waits on something, which means a cycle.
        return order if len(order) == n else []
