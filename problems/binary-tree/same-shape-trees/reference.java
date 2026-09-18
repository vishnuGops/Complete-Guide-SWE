import java.util.*;

class Solution {
    public boolean sameTree(TreeNode first, TreeNode second) {
        // A stack of pairs: a chain of two thousand nodes costs no recursion.
        Deque<TreeNode[]> pairs = new ArrayDeque<>();
        pairs.push(new TreeNode[] {first, second});

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
            pairs.push(new TreeNode[] {left.left, right.left});
            pairs.push(new TreeNode[] {left.right, right.right});
        }

        return true;
    }
}
