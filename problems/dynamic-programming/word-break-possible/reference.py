from typing import List


class Solution:
    def canBeRead(self, letters: str, dictionary: List[str]) -> bool:
        words = set(dictionary)
        longest = max((len(word) for word in dictionary), default=0)

        n = len(letters)
        reachable = [False] * (n + 1)
        reachable[0] = True   # no letters, read with no words

        for end in range(1, n + 1):
            # No point looking back further than the longest word.
            start = max(0, end - longest)
            for begin in range(start, end):
                if reachable[begin] and letters[begin:end] in words:
                    reachable[end] = True
                    break

        return reachable[n]
