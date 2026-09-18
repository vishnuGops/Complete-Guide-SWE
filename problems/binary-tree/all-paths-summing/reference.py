from typing import List, Optional, Tuple


class Solution:
    def pathsSumming(self, root: Optional[TreeNode], target: int) -> List[List[int]]:
        out: List[List[int]] = []
        if root is None:
            return out

        # (node, what is still needed, the values above it). Right is pushed
        # first so the left subtree is explored first.
        stack: List[Tuple[TreeNode, int, List[int]]] = [(root, target, [])]

        while stack:
            node, needed, above = stack.pop()
            path = above + [node.val]
            remaining = needed - node.val

            if node.left is None and node.right is None:
                if remaining == 0:
                    out.append(path)
                continue

            if node.right is not None:
                stack.append((node.right, remaining, path))
            if node.left is not None:
                stack.append((node.left, remaining, path))

        return out
