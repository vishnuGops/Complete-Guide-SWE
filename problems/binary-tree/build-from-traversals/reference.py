from typing import Dict, List, Optional, Tuple


class Solution:
    def rebuild(self, preorder: List[int], inorder: List[int]) -> Optional[TreeNode]:
        # Built once: scanning for the root instead is what makes this O(n^2).
        where: Dict[int, int] = {value: index for index, value in enumerate(inorder)}

        root: Optional[TreeNode] = None
        # (pre start, in start, how many, parent, 0 for left and 1 for right)
        work: List[Tuple[int, int, int, Optional[TreeNode], int]] = [
            (0, 0, len(preorder), None, 0)
        ]

        while work:
            pre_start, in_start, count, parent, side = work.pop()
            if count == 0:
                continue

            value = preorder[pre_start]
            node = TreeNode(value)
            if parent is None:
                root = node
            elif side == 0:
                parent.left = node
            else:
                parent.right = node

            middle = where[value]
            left_size = middle - in_start
            work.append((pre_start + 1, in_start, left_size, node, 0))
            work.append((pre_start + 1 + left_size, middle + 1, count - 1 - left_size, node, 1))

        return root
