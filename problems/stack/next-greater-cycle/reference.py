from typing import List


class Solution:
    def nextGreaterWrapping(self, readings: List[int]) -> List[int]:
        n = len(readings)
        answer = [-1] * n
        # Positions whose answer is still unknown, in decreasing value order.
        waiting: List[int] = []

        for step in range(2 * n):
            position = step % n
            while waiting and readings[waiting[-1]] < readings[position]:
                answer[waiting.pop()] = readings[position]
            if step < n:
                waiting.append(position)

        return answer
