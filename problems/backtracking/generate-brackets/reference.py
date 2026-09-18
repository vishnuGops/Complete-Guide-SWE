from typing import List


class Solution:
    def balancedFragments(self, n: int, depth: int) -> List[str]:
        out: List[str] = []
        sofar: List[str] = []

        def build(opened: int, closed: int) -> None:
            if opened == n and closed == n:
                out.append("".join(sofar))
                return
            # Room for another pair, and room to nest one deeper.
            if opened < n and opened - closed < depth:
                sofar.append("(")
                build(opened + 1, closed)
                sofar.pop()
            # Something is open to close.
            if closed < opened:
                sofar.append(")")
                build(opened, closed + 1)
                sofar.pop()

        build(0, 0)
        return out
