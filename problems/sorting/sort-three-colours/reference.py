from typing import List


class Solution:
    def sortThreeKinds(self, grades: List[int]) -> None:
        low = 0
        at = 0
        high = len(grades) - 1

        while at <= high:
            if grades[at] == 0:
                grades[low], grades[at] = grades[at], grades[low]
                low += 1
                at += 1
            elif grades[at] == 2:
                grades[high], grades[at] = grades[at], grades[high]
                high -= 1
                # `at` does not move: the value from the back is unexamined.
            else:
                at += 1
