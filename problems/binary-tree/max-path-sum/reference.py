from typing import Dict, List, Optional, Tuple


class Solution:
    def bestPathSum(self, root: Optional[TreeNode]) -> int:
        # An explicit post-order walk: the children report before the node.
        best = None
        downward: Dict[int, int] = {}
        stack: List[Tuple[TreeNode, bool]] = [(root, False)]

        while stack:
            node, ready = stack.pop()
            if not ready:
                stack.append((node, True))
                if node.left is not None:
                    stack.append((node.left, False))
                if node.right is not None:
                    stack.append((node.right, False))
                continue

            # A negative side is never worth taking.
            left = max(0, downward[id(node.left)]) if node.left is not None else 0
            right = max(0, downward[id(node.right)]) if node.right is not None else 0

            # Turning around here may use both sides.
            through = node.val + left + right
            if best is None or through > best:
                best = through

            # Continuing upwards may use only one.
            downward[id(node)] = node.val + max(left, right)

        return best
