from typing import List, Optional


class Solution:
    def rewrite(self, written: str) -> str:
        return self._level_order(self._read(written))

    def _read(self, written: str) -> Optional[TreeNode]:
        tokens = written.split(",")
        if tokens[0] == "#":
            return None

        root = TreeNode(int(tokens[0]))
        # (node being filled, 0 if its left child is next, 1 if its right is)
        stack: List[List] = [[root, 0]]
        at = 1

        while stack and at < len(tokens):
            token = tokens[at]
            at += 1
            child = None if token == "#" else TreeNode(int(token))

            top = stack[-1]
            if top[1] == 0:
                top[0].left = child
                top[1] = 1
            else:
                top[0].right = child
                stack.pop()
            if child is not None:
                stack.append([child, 0])

        return root

    def _level_order(self, root: Optional[TreeNode]) -> str:
        if root is None:
            return "#"

        out: List[str] = []
        queue: List[Optional[TreeNode]] = [root]
        at = 0
        while at < len(queue):
            node = queue[at]
            at += 1
            if node is None:
                out.append("#")
                continue
            out.append(str(node.val))
            queue.append(node.left)
            queue.append(node.right)

        # Only the trailing gaps say nothing; the ones in the middle do.
        while out and out[-1] == "#":
            out.pop()
        return ",".join(out)
