import java.util.*;

class BlankDictionary {

    private static final class Node {
        final Node[] children = new Node[26];
        boolean ends;
    }

    private final Node root = new Node();

    BlankDictionary() {
    }

    public void add(String word) {
        Node node = root;
        for (int i = 0; i < word.length(); i++) {
            int letter = word.charAt(i) - 'a';
            if (node.children[letter] == null) {
                node.children[letter] = new Node();
            }
            node = node.children[letter];
        }
        node.ends = true;
    }

    public boolean matches(String pattern) {
        return search(root, pattern, 0);
    }

    private boolean search(Node node, String pattern, int at) {
        if (at == pattern.length()) {
            return node.ends;
        }

        char letter = pattern.charAt(at);
        if (letter != '.') {
            Node child = node.children[letter - 'a'];
            return child != null && search(child, pattern, at + 1);
        }

        // A blank: every child that exists is worth trying.
        for (Node child : node.children) {
            if (child != null && search(child, pattern, at + 1)) {
                return true;
            }
        }
        return false;
    }
}
