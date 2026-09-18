from typing import List, Optional, Tuple


class Solution:
    def isMirror(self, root: Optional[TreeNode]) -> bool:
        if root is None:
            return True

        # Pairs that must mirror each other; note the crossing over below.
        pairs: List[Tuple[Optional[TreeNode], Optional[TreeNode]]] = [(root.left, root.right)]

        while pairs:
            left, right = pairs.pop()
            if left is None and right is None:
                continue
            if left is None or right is None:
                return False
            if left.val != right.val:
                return False
            pairs.append((left.left, right.right))
            pairs.append((left.right, right.left))

        return True
