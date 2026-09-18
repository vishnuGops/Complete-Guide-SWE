from typing import List


class Solution:
    def restoreAddresses(self, digits: str) -> List[str]:
        out: List[str] = []
        parts: List[str] = []

        def build(at: int, placed: int) -> None:
            left = len(digits) - at
            remaining = 4 - placed
            # Too few digits to fill the numbers left, or too many to fit.
            if left < remaining or left > 3 * remaining:
                return
            if placed == 4:
                if at == len(digits):
                    out.append(".".join(parts))
                return
            for length in (1, 2, 3):
                if at + length > len(digits):
                    break
                piece = digits[at:at + length]
                if length > 1 and piece[0] == "0":
                    break
                if int(piece) > 255:
                    break
                parts.append(piece)
                build(at + length, placed + 1)
                parts.pop()

        build(0, 0)
        return out
