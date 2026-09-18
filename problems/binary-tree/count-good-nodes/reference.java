import java.util.*;

class Solution {
    public int countGoodNodes(TreeNode root) {
        if (root == null) {
            return 0;
        }

        // (node, the largest value on the path above it)
        Deque<TreeNode> nodes = new ArrayDeque<>();
        Deque<Integer> bests = new ArrayDeque<>();
        nodes.push(root);
        bests.push(root.val);
        int count = 0;

        while (!nodes.isEmpty()) {
            TreeNode node = nodes.pop();
            int best = bests.pop();

            // Equal does not block, so the comparison is not strict.
            if (node.val >= best) {
                count++;
            }
            if (node.val > best) {
                best = node.val;
            }
            if (node.left != null) {
                nodes.push(node.left);
                bests.push(best);
            }
            if (node.right != null) {
                nodes.push(node.right);
                bests.push(best);
            }
        }

        return count;
    }
}
