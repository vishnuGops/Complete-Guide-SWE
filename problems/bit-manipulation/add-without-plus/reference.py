MASK = 0xFFFFFFFF
SIGN = 1 << 31


class Solution:
    def addThem(self, first: int, second: int) -> int:
        # Python's integers are unbounded, so a negative value has infinitely
        # many leading ones and the carry would never run out.
        first &= MASK
        second &= MASK

        while second:
            carry = ((first & second) << 1) & MASK
            first = (first ^ second) & MASK
            second = carry

        return first - (1 << 32) if first & SIGN else first
