import java.util.*;

class Solution {
    public boolean hasPathSum(TreeNode root, int target) {
        if (root == null) {
            return false;
        }

        // (node, what the rest of the path still has to add up to)
        Deque<TreeNode> nodes = new ArrayDeque<>();
        Deque<Integer> needed = new ArrayDeque<>();
        nodes.push(root);
        needed.push(target);

        while (!nodes.isEmpty()) {
            TreeNode node = nodes.pop();
            int remaining = needed.pop();

            if (node.left == null && node.right == null) {
                if (remaining == node.val) {
                    return true;
                }
                continue;
            }
            if (node.left != null) {
                nodes.push(node.left);
                needed.push(remaining - node.val);
            }
            if (node.right != null) {
                nodes.push(node.right);
                needed.push(remaining - node.val);
            }
        }

        return false;
    }
}
