import heapq
from typing import Dict, List, Optional, Tuple


class Solution:
    def reorganise(self, letters: str) -> str:
        counts: Dict[str, int] = {}
        for letter in letters:
            counts[letter] = counts.get(letter, 0) + 1

        # A max-heap, so the counts go in negated.
        heap = [(-count, letter) for letter, count in counts.items()]
        heapq.heapify(heap)

        out: List[str] = []
        held: Optional[Tuple[int, str]] = None

        while heap:
            count, letter = heapq.heappop(heap)
            out.append(letter)
            # The letter used last step may be chosen again from now on.
            if held is not None:
                heapq.heappush(heap, held)
                held = None
            if count + 1 < 0:
                held = (count + 1, letter)

        # A letter still held has copies with nowhere left to put them.
        if held is not None:
            return ""
        return "".join(out)
