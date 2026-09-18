import java.util.*;

class Solution {
    public List<List<Integer>> pathsSumming(TreeNode root, int target) {
        List<List<Integer>> out = new ArrayList<>();
        if (root == null) {
            return out;
        }

        // (node, what is still needed, the values above it). Right is pushed
        // first so the left subtree is explored first.
        Deque<TreeNode> nodes = new ArrayDeque<>();
        Deque<Integer> needed = new ArrayDeque<>();
        Deque<List<Integer>> aboves = new ArrayDeque<>();
        nodes.push(root);
        needed.push(target);
        aboves.push(new ArrayList<>());

        while (!nodes.isEmpty()) {
            TreeNode node = nodes.pop();
            int remaining = needed.pop() - node.val;
            List<Integer> path = new ArrayList<>(aboves.pop());
            path.add(node.val);

            if (node.left == null && node.right == null) {
                if (remaining == 0) {
                    out.add(path);
                }
                continue;
            }

            if (node.right != null) {
                nodes.push(node.right);
                needed.push(remaining);
                aboves.push(path);
            }
            if (node.left != null) {
                nodes.push(node.left);
                needed.push(remaining);
                aboves.push(path);
            }
        }

        return out;
    }
}
