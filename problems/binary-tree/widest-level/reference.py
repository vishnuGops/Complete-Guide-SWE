from collections import deque
from typing import List, Optional


class Solution:
    def widestLevel(self, root: Optional[TreeNode]) -> List[int]:
        if root is None:
            return [0, 0]

        best = 0
        best_level = 0
        level = 0
        queue = deque([root])

        while queue:
            width = len(queue)
            level += 1
            # Strictly greater, so a tie stays with the higher level.
            if width > best:
                best = width
                best_level = level
            for _ in range(width):
                node = queue.popleft()
                if node.left is not None:
                    queue.append(node.left)
                if node.right is not None:
                    queue.append(node.right)

        return [best, best_level]
