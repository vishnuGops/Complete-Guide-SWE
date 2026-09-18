class Solution:
    def countOnes(self, value: int) -> int:
        count = 0
        while value:
            # Clears exactly the lowest set bit.
            value &= value - 1
            count += 1
        return count
