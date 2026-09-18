from typing import List


class Solution:
    def smallestAfterRemoving(self, digits: str, k: int) -> str:
        kept: List[str] = []
        remaining = k

        for digit in digits:
            while remaining > 0 and kept and kept[-1] > digit:
                kept.pop()
                remaining -= 1
            kept.append(digit)

        # What is left is non-decreasing, so any unused removals come off the
        # back, where the largest digits are.
        if remaining > 0:
            kept = kept[:len(kept) - remaining]

        answer = "".join(kept).lstrip("0")
        return answer if answer else "0"
