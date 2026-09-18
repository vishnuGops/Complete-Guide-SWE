from typing import Dict


class Solution:
    def leastTime(self, tasks: str, cooldown: int) -> int:
        counts: Dict[str, int] = {}
        for task in tasks:
            counts[task] = counts.get(task, 0) + 1

        most = max(counts.values())
        tied = sum(1 for count in counts.values() if count == most)

        # The skeleton the most frequent task forces, plus one tick for every
        # task tied with it.
        skeleton = (most - 1) * (cooldown + 1) + tied

        # If the gaps overflow there is no idling at all.
        return max(len(tasks), skeleton)
