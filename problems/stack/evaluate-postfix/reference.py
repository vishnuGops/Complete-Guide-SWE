from typing import List


class Solution:
    def evaluatePostfix(self, tokens: List[str]) -> int:
        stack: List[int] = []

        for token in tokens:
            if token in ("+", "-", "*", "/"):
                right = stack.pop()
                left = stack.pop()
                if token == "+":
                    stack.append(left + right)
                elif token == "-":
                    stack.append(left - right)
                elif token == "*":
                    stack.append(left * right)
                else:
                    # Towards zero, not towards minus infinity: Python's //
                    # floors, so divide the magnitudes and reapply the sign.
                    magnitude = abs(left) // abs(right)
                    stack.append(magnitude if (left < 0) == (right < 0) else -magnitude)
            else:
                stack.append(int(token))

        return stack.pop()
