from typing import Dict


class Solution:
    def shortestCover(self, log: str, need: str) -> str:
        if len(need) > len(log):
            return ""

        quota: Dict[str, int] = {}
        for letter in need:
            quota[letter] = quota.get(letter, 0) + 1

        have: Dict[str, int] = {}
        short = len(quota)
        best_start = 0
        best_length = -1
        left = 0

        for right, letter in enumerate(log):
            if letter in quota:
                have[letter] = have.get(letter, 0) + 1
                if have[letter] == quota[letter]:
                    short -= 1

            while short == 0:
                if best_length == -1 or right - left + 1 < best_length:
                    best_length = right - left + 1
                    best_start = left
                dropped = log[left]
                if dropped in quota:
                    if have[dropped] == quota[dropped]:
                        short += 1
                    have[dropped] -= 1
                left += 1

        if best_length == -1:
            return ""
        return log[best_start:best_start + best_length]
