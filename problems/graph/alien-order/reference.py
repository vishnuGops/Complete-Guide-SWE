import heapq
from typing import Dict, List, Set


class Solution:
    def alphabetOrder(self, words: List[str]) -> str:
        present: Set[str] = set()
        for word in words:
            present.update(word)

        after: Dict[str, Set[str]] = {letter: set() for letter in present}
        waiting: Dict[str, int] = {letter: 0 for letter in present}

        for first, second in zip(words, words[1:]):
            shared = min(len(first), len(second))
            at = 0
            while at < shared and first[at] == second[at]:
                at += 1
            if at == shared:
                # Identical as far as the shorter word goes: a longer word
                # before its own prefix is impossible in any alphabet.
                if len(first) > len(second):
                    return ""
                continue
            if second[at] not in after[first[at]]:
                after[first[at]].add(second[at])
                waiting[second[at]] += 1

        # A heap, not a queue: the answer must be the smallest valid order.
        available = [letter for letter in present if waiting[letter] == 0]
        heapq.heapify(available)

        order: List[str] = []
        while available:
            letter = heapq.heappop(available)
            order.append(letter)
            for later in sorted(after[letter]):
                waiting[later] -= 1
                if waiting[later] == 0:
                    heapq.heappush(available, later)

        return "".join(order) if len(order) == len(present) else ""
