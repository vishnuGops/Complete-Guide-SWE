from collections import deque
from typing import List, Optional


class Solution:
    def levelOrder(self, root: Optional[TreeNode]) -> List[List[int]]:
        if root is None:
            return []

        out: List[List[int]] = []
        queue = deque([root])

        while queue:
            # Fixed before the round: the nodes added below belong to the next.
            width = len(queue)
            level: List[int] = []
            for _ in range(width):
                node = queue.popleft()
                level.append(node.val)
                if node.left is not None:
                    queue.append(node.left)
                if node.right is not None:
                    queue.append(node.right)
            out.append(level)

        return out
