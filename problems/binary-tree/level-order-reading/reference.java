import java.util.*;

class Solution {
    public List<List<Integer>> levelOrder(TreeNode root) {
        List<List<Integer>> out = new ArrayList<>();
        if (root == null) {
            return out;
        }

        Deque<TreeNode> queue = new ArrayDeque<>();
        queue.addLast(root);

        while (!queue.isEmpty()) {
            // Fixed before the round: the nodes added below belong to the next.
            int width = queue.size();
            List<Integer> level = new ArrayList<>(width);
            for (int i = 0; i < width; i++) {
                TreeNode node = queue.removeFirst();
                level.add(node.val);
                if (node.left != null) {
                    queue.addLast(node.left);
                }
                if (node.right != null) {
                    queue.addLast(node.right);
                }
            }
            out.add(level);
        }

        return out;
    }
}
