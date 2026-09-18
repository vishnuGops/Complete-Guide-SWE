from typing import List, Optional, Tuple


class Solution:
    def isSearchTree(self, root: Optional[TreeNode]) -> bool:
        # (node, exclusive lower bound, exclusive upper bound); None is absent.
        stack: List[Tuple[TreeNode, Optional[int], Optional[int]]] = []
        if root is not None:
            stack.append((root, None, None))

        while stack:
            node, low, high = stack.pop()
            if low is not None and node.val <= low:
                return False
            if high is not None and node.val >= high:
                return False
            if node.left is not None:
                stack.append((node.left, low, node.val))
            if node.right is not None:
                stack.append((node.right, node.val, high))

        return True
