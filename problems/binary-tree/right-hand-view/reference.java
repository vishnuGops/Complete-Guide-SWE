import java.util.*;

class Solution {
    public int[] rightHandView(TreeNode root) {
        List<Integer> out = new ArrayList<>();
        if (root == null) {
            return new int[0];
        }

        Deque<TreeNode> queue = new ArrayDeque<>();
        queue.addLast(root);

        while (!queue.isEmpty()) {
            int width = queue.size();
            for (int position = 0; position < width; position++) {
                TreeNode node = queue.removeFirst();
                // The last node of the level is the one that is visible.
                if (position == width - 1) {
                    out.add(node.val);
                }
                if (node.left != null) {
                    queue.addLast(node.left);
                }
                if (node.right != null) {
                    queue.addLast(node.right);
                }
            }
        }

        int[] answer = new int[out.size()];
        for (int i = 0; i < answer.length; i++) {
            answer[i] = out.get(i);
        }
        return answer;
    }
}
