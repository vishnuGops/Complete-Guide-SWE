from typing import Optional


class Solution:
    def flatten(self, root: Optional[TreeNode]) -> None:
        node = root
        while node is not None:
            if node.left is not None:
                # The right subtree goes after the last node of the left one.
                rightmost = node.left
                while rightmost.right is not None:
                    rightmost = rightmost.right
                rightmost.right = node.right
                node.right = node.left
                node.left = None
            node = node.right
