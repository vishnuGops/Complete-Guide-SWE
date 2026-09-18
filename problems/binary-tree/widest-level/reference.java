import java.util.*;

class Solution {
    public int[] widestLevel(TreeNode root) {
        if (root == null) {
            return new int[] {0, 0};
        }

        int best = 0;
        int bestLevel = 0;
        int level = 0;
        Deque<TreeNode> queue = new ArrayDeque<>();
        queue.addLast(root);

        while (!queue.isEmpty()) {
            int width = queue.size();
            level++;
            // Strictly greater, so a tie stays with the higher level.
            if (width > best) {
                best = width;
                bestLevel = level;
            }
            for (int i = 0; i < width; i++) {
                TreeNode node = queue.removeFirst();
                if (node.left != null) {
                    queue.addLast(node.left);
                }
                if (node.right != null) {
                    queue.addLast(node.right);
                }
            }
        }

        return new int[] {best, bestLevel};
    }
}
