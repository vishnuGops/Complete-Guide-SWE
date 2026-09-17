class Solution:
    def firstUnique(self, text: str) -> int:
        counts = [0] * 26
        base = ord("a")
        for symbol in text:
            counts[ord(symbol) - base] += 1
        for index, symbol in enumerate(text):
            if counts[ord(symbol) - base] == 1:
                return index
        return -1
