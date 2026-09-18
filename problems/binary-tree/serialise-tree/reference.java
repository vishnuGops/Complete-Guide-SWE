import java.util.*;

class Solution {
    public String rewrite(String written) {
        return levelOrder(read(written));
    }

    private TreeNode read(String written) {
        String[] tokens = written.split(",", -1);
        if (tokens[0].equals("#")) {
            return null;
        }

        TreeNode root = new TreeNode(Integer.parseInt(tokens[0]));
        // (node being filled, 0 if its left child is next, 1 if its right is)
        Deque<TreeNode> filling = new ArrayDeque<>();
        Deque<int[]> side = new ArrayDeque<>();
        filling.push(root);
        side.push(new int[] {0});
        int at = 1;

        while (!filling.isEmpty() && at < tokens.length) {
            String token = tokens[at];
            at++;
            TreeNode child = token.equals("#") ? null : new TreeNode(Integer.parseInt(token));

            TreeNode top = filling.peek();
            int[] which = side.peek();
            if (which[0] == 0) {
                top.left = child;
                which[0] = 1;
            } else {
                top.right = child;
                filling.pop();
                side.pop();
            }
            if (child != null) {
                filling.push(child);
                side.push(new int[] {0});
            }
        }

        return root;
    }

    private String levelOrder(TreeNode root) {
        if (root == null) {
            return "#";
        }

        List<String> out = new ArrayList<>();
        List<TreeNode> queue = new ArrayList<>();
        queue.add(root);
        for (int at = 0; at < queue.size(); at++) {
            TreeNode node = queue.get(at);
            if (node == null) {
                out.add("#");
                continue;
            }
            out.add(Integer.toString(node.val));
            queue.add(node.left);
            queue.add(node.right);
        }

        // Only the trailing gaps say nothing; the ones in the middle do.
        while (!out.isEmpty() && out.get(out.size() - 1).equals("#")) {
            out.remove(out.size() - 1);
        }
        return String.join(",", out);
    }
}
