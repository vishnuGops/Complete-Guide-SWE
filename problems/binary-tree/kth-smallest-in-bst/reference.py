from typing import List, Optional


class Solution:
    def kthSmallest(self, root: Optional[TreeNode], k: int) -> int:
        stack: List[TreeNode] = []
        node = root
        remaining = k

        while True:
            # Descend to the smallest value not yet visited.
            while node is not None:
                stack.append(node)
                node = node.left

            node = stack.pop()
            remaining -= 1
            if remaining == 0:
                return node.val
            node = node.right
