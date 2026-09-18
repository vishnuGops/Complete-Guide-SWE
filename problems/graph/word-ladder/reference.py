from collections import deque
from typing import Dict, List


class Solution:
    def ladderLength(self, start: str, target: str, words: List[str]) -> int:
        allowed = set(words)
        if target not in allowed:
            return 0
        if start == target:
            return 1

        # Blanked form -> the words matching it. Two words differ in exactly
        # one position exactly when they share one of these.
        buckets: Dict[str, List[str]] = {}
        for word in words:
            for at in range(len(word)):
                form = word[:at] + "*" + word[at + 1:]
                buckets.setdefault(form, []).append(word)

        seen = {start}
        queue = deque([(start, 1)])

        while queue:
            word, rungs = queue.popleft()
            for at in range(len(word)):
                form = word[:at] + "*" + word[at + 1:]
                for other in buckets.get(form, ()):
                    if other == target:
                        return rungs + 1
                    if other not in seen:
                        # Marked when queued, so a word is walked once.
                        seen.add(other)
                        queue.append((other, rungs + 1))
                buckets[form] = []

        return 0
