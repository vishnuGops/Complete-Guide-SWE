class Solution:
    def isPowerOfTwo(self, value: int) -> bool:
        # Positive, and exactly one bit set: clearing the lowest leaves nothing.
        return value > 0 and (value & (value - 1)) == 0
