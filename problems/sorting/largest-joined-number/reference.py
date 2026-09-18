from functools import cmp_to_key
from typing import List


class Solution:
    def largestJoined(self, parts: List[int]) -> str:
        def order(left: str, right: str) -> int:
            if left + right > right + left:
                return -1
            if left + right < right + left:
                return 1
            return 0

        written = sorted((str(part) for part in parts), key=cmp_to_key(order))
        joined = "".join(written)
        # All zeroes would otherwise print as "000".
        return "0" if joined[0] == "0" else joined
