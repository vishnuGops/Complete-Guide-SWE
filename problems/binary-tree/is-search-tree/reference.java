import java.util.*;

class Solution {
    public boolean isSearchTree(TreeNode root) {
        // (node, exclusive lower bound, exclusive upper bound); null is absent.
        Deque<TreeNode> nodes = new ArrayDeque<>();
        Deque<Long[]> bounds = new ArrayDeque<>();
        if (root != null) {
            nodes.push(root);
            bounds.push(new Long[] {null, null});
        }

        while (!nodes.isEmpty()) {
            TreeNode node = nodes.pop();
            Long[] range = bounds.pop();
            Long low = range[0];
            Long high = range[1];

            if (low != null && node.val <= low) {
                return false;
            }
            if (high != null && node.val >= high) {
                return false;
            }
            if (node.left != null) {
                nodes.push(node.left);
                bounds.push(new Long[] {low, (long) node.val});
            }
            if (node.right != null) {
                nodes.push(node.right);
                bounds.push(new Long[] {(long) node.val, high});
            }
        }

        return true;
    }
}
