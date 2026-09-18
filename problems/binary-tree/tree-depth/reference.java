import java.util.*;

class Solution {
    public int depthOf(TreeNode root) {
        if (root == null) {
            return 0;
        }

        // Level by level, so a chain of two thousand nodes costs no stack.
        int depth = 0;
        List<TreeNode> level = new ArrayList<>();
        level.add(root);
        while (!level.isEmpty()) {
            depth++;
            List<TreeNode> below = new ArrayList<>();
            for (TreeNode node : level) {
                if (node.left != null) {
                    below.add(node.left);
                }
                if (node.right != null) {
                    below.add(node.right);
                }
            }
            level = below;
        }

        return depth;
    }
}
