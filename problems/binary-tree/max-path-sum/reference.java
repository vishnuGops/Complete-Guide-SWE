import java.util.*;

class Solution {
    public int bestPathSum(TreeNode root) {
        // An explicit post-order walk: the children report before the node.
        int best = Integer.MIN_VALUE;
        Map<TreeNode, Integer> downward = new IdentityHashMap<>();
        Deque<TreeNode> nodes = new ArrayDeque<>();
        Deque<Boolean> ready = new ArrayDeque<>();
        nodes.push(root);
        ready.push(false);

        while (!nodes.isEmpty()) {
            TreeNode node = nodes.pop();
            boolean done = ready.pop();

            if (!done) {
                nodes.push(node);
                ready.push(true);
                if (node.left != null) {
                    nodes.push(node.left);
                    ready.push(false);
                }
                if (node.right != null) {
                    nodes.push(node.right);
                    ready.push(false);
                }
                continue;
            }

            // A negative side is never worth taking.
            int left = node.left != null ? Math.max(0, downward.get(node.left)) : 0;
            int right = node.right != null ? Math.max(0, downward.get(node.right)) : 0;

            // Turning around here may use both sides.
            best = Math.max(best, node.val + left + right);

            // Continuing upwards may use only one.
            downward.put(node, node.val + Math.max(left, right));
        }

        return best;
    }
}
