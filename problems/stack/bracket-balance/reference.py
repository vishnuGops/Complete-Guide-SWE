from typing import Dict, List


class Solution:
    def isBalanced(self, text: str) -> bool:
        closes: Dict[str, str] = {")": "(", "]": "[", "}": "{"}
        open_brackets: List[str] = []
        for symbol in text:
            if symbol in closes:
                if not open_brackets or open_brackets.pop() != closes[symbol]:
                    return False
            else:
                open_brackets.append(symbol)
        return not open_brackets
