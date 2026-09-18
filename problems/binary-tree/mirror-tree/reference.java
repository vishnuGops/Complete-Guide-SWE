import java.util.*;

class Solution {
    public boolean isMirror(TreeNode root) {
        if (root == null) {
            return true;
        }

        // Pairs that must mirror each other; note the crossing over below.
        Deque<TreeNode[]> pairs = new ArrayDeque<>();
        pairs.push(new TreeNode[] {root.left, root.right});

        while (!pairs.isEmpty()) {
            TreeNode[] pair = pairs.pop();
            TreeNode left = pair[0];
            TreeNode right = pair[1];
            if (left == null && right == null) {
                continue;
            }
            if (left == null || right == null) {
                return false;
            }
            if (left.val != right.val) {
                return false;
            }
            pairs.push(new TreeNode[] {left.left, right.right});
            pairs.push(new TreeNode[] {left.right, right.left});
        }

        return true;
    }
}
