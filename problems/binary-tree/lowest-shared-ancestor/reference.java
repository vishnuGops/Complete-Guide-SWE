import java.util.*;

class Solution {
    public int sharedAncestor(TreeNode root, int first, int second) {
        // One walk for the parents, and for where the two values live.
        Map<TreeNode, TreeNode> parent = new IdentityHashMap<>();
        TreeNode foundFirst = null;
        TreeNode foundSecond = null;

        Deque<TreeNode> stack = new ArrayDeque<>();
        stack.push(root);
        parent.put(root, null);
        while (!stack.isEmpty()) {
            TreeNode node = stack.pop();
            if (node.val == first) {
                foundFirst = node;
            }
            if (node.val == second) {
                foundSecond = node;
            }
            for (TreeNode child : new TreeNode[] {node.left, node.right}) {
                if (child != null) {
                    parent.put(child, node);
                    stack.push(child);
                }
            }
        }

        // Climb from the deeper end: the first shared ancestor met is the lowest.
        Set<TreeNode> seen = Collections.newSetFromMap(new IdentityHashMap<>());
        for (TreeNode walker = foundFirst; walker != null; walker = parent.get(walker)) {
            seen.add(walker);
        }
        for (TreeNode walker = foundSecond; walker != null; walker = parent.get(walker)) {
            if (seen.contains(walker)) {
                return walker.val;
            }
        }

        return root.val;
    }
}
