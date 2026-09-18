import java.util.*;

class Solution {
    public int kthSmallest(TreeNode root, int k) {
        Deque<TreeNode> stack = new ArrayDeque<>();
        TreeNode node = root;
        int remaining = k;

        while (true) {
            // Descend to the smallest value not yet visited.
            while (node != null) {
                stack.push(node);
                node = node.left;
            }

            node = stack.pop();
            remaining--;
            if (remaining == 0) {
                return node.val;
            }
            node = node.right;
        }
    }
}
