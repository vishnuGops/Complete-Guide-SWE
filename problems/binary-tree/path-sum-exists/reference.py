from typing import List, Optional, Tuple


class Solution:
    def hasPathSum(self, root: Optional[TreeNode], target: int) -> bool:
        if root is None:
            return False

        # (node, what the rest of the path still has to add up to)
        stack: List[Tuple[TreeNode, int]] = [(root, target)]

        while stack:
            node, needed = stack.pop()
            if node.left is None and node.right is None:
                if needed == node.val:
                    return True
                continue
            if node.left is not None:
                stack.append((node.left, needed - node.val))
            if node.right is not None:
                stack.append((node.right, needed - node.val))

        return False
