import java.util.*;

class Solution {
    public TreeNode rebuild(int[] preorder, int[] inorder) {
        // Built once: scanning for the root instead is what makes this O(n^2).
        Map<Integer, Integer> where = new HashMap<>();
        for (int index = 0; index < inorder.length; index++) {
            where.put(inorder[index], index);
        }

        TreeNode root = null;
        // (pre start, in start, how many, 0 for left and 1 for right)
        Deque<int[]> ranges = new ArrayDeque<>();
        Deque<TreeNode> parents = new ArrayDeque<>();
        ranges.push(new int[] {0, 0, preorder.length, 0});
        parents.push(new TreeNode(0)); // a stand-in for "no parent"
        TreeNode noParent = parents.peek();

        while (!ranges.isEmpty()) {
            int[] range = ranges.pop();
            TreeNode parent = parents.pop();
            int preStart = range[0];
            int inStart = range[1];
            int count = range[2];
            int side = range[3];
            if (count == 0) {
                continue;
            }

            int value = preorder[preStart];
            TreeNode node = new TreeNode(value);
            if (parent == noParent) {
                root = node;
            } else if (side == 0) {
                parent.left = node;
            } else {
                parent.right = node;
            }

            int middle = where.get(value);
            int leftSize = middle - inStart;
            ranges.push(new int[] {preStart + 1, inStart, leftSize, 0});
            parents.push(node);
            ranges.push(new int[] {preStart + 1 + leftSize, middle + 1, count - 1 - leftSize, 1});
            parents.push(node);
        }

        return root;
    }
}
