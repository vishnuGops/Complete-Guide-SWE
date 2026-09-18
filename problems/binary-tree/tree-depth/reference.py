from typing import List, Optional


class Solution:
    def depthOf(self, root: Optional[TreeNode]) -> int:
        if root is None:
            return 0

        # Level by level, so a chain of two thousand nodes costs no stack.
        depth = 0
        level: List[TreeNode] = [root]
        while level:
            depth += 1
            below: List[TreeNode] = []
            for node in level:
                if node.left is not None:
                    below.append(node.left)
                if node.right is not None:
                    below.append(node.right)
            level = below

        return depth
