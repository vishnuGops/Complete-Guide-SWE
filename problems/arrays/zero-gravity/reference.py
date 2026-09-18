from typing import List


class Solution:
    def sinkZeroes(self, slots: List[int]) -> None:
        write = 0
        for read, value in enumerate(slots):
            if value != 0:
                slots[write], slots[read] = slots[read], slots[write]
                write += 1
