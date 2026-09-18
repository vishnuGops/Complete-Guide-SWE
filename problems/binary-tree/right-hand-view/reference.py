from collections import deque
from typing import List, Optional


class Solution:
    def rightHandView(self, root: Optional[TreeNode]) -> List[int]:
        if root is None:
            return []

        out: List[int] = []
        queue = deque([root])

        while queue:
            width = len(queue)
            for position in range(width):
                node = queue.popleft()
                # The last node of the level is the one that is visible.
                if position == width - 1:
                    out.append(node.val)
                if node.left is not None:
                    queue.append(node.left)
                if node.right is not None:
                    queue.append(node.right)

        return out
