from typing import List, Optional, Tuple


class Solution:
    def sameTree(self, first: Optional[TreeNode], second: Optional[TreeNode]) -> bool:
        # A stack of pairs: a chain of two thousand nodes costs no recursion.
        pairs: List[Tuple[Optional[TreeNode], Optional[TreeNode]]] = [(first, second)]

        while pairs:
            left, right = pairs.pop()
            if left is None and right is None:
                continue
            if left is None or right is None:
                return False
            if left.val != right.val:
                return False
            pairs.append((left.left, right.left))
            pairs.append((left.right, right.right))

        return True
