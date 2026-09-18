from typing import List, Optional, Tuple


class Solution:
    def countGoodNodes(self, root: Optional[TreeNode]) -> int:
        if root is None:
            return 0

        # (node, the largest value on the path above it)
        stack: List[Tuple[TreeNode, int]] = [(root, root.val)]
        count = 0

        while stack:
            node, best = stack.pop()
            # Equal does not block, so the comparison is not strict.
            if node.val >= best:
                count += 1
            if node.val > best:
                best = node.val
            if node.left is not None:
                stack.append((node.left, best))
            if node.right is not None:
                stack.append((node.right, best))

        return count
