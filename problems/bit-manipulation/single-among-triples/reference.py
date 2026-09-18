from typing import List

MASK = 0xFFFFFFFF


class Solution:
    def theOddOneOut(self, values: List[int]) -> int:
        # Bits seen once so far, and bits seen twice. A bit reaching three is
        # cleared from both, so every position counts modulo three at once.
        ones = 0
        twos = 0

        for value in values:
            # Python's integers are unbounded, so the row is masked to 32 bits.
            value &= MASK
            ones = ((ones ^ value) & ~twos) & MASK
            twos = ((twos ^ value) & ~ones) & MASK

        # Back to a signed 32-bit value.
        return ones - (1 << 32) if ones & (1 << 31) else ones
