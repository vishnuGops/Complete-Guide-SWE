class Solution:
    def waysUp(self, n: int) -> int:
        # Only the last two values are ever needed.
        two_back = 1   # ways to reach step 0
        one_back = 1   # ways to reach step 1
        if n == 0:
            return two_back

        for _ in range(2, n + 1):
            two_back, one_back = one_back, one_back + two_back

        return one_back
