from typing import Dict, List, Tuple


class Solution:
    def groupAnagrams(self, words: List[str]) -> List[List[str]]:
        groups: Dict[Tuple[int, ...], List[str]] = {}
        base = ord("a")
        for word in words:
            counts = [0] * 26
            for symbol in word:
                counts[ord(symbol) - base] += 1
            groups.setdefault(tuple(counts), []).append(word)
        return list(groups.values())
