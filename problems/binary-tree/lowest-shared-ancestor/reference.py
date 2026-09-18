from typing import Dict, List, Optional


class Solution:
    def sharedAncestor(self, root: Optional[TreeNode], first: int, second: int) -> int:
        # One walk for the parents, and for where the two values live.
        parent: Dict[int, Optional[TreeNode]] = {}
        found_first: Optional[TreeNode] = None
        found_second: Optional[TreeNode] = None

        stack: List[TreeNode] = [root]
        parent[id(root)] = None
        while stack:
            node = stack.pop()
            if node.val == first:
                found_first = node
            if node.val == second:
                found_second = node
            for child in (node.left, node.right):
                if child is not None:
                    parent[id(child)] = node
                    stack.append(child)

        # Climb from the deeper end: the first shared ancestor met is the lowest.
        seen = set()
        walker = found_first
        while walker is not None:
            seen.add(id(walker))
            walker = parent[id(walker)]

        walker = found_second
        while walker is not None:
            if id(walker) in seen:
                return walker.val
            walker = parent[id(walker)]

        return root.val
