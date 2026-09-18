import java.util.*;

class PrefixTree {

    private static final class Node {
        final Node[] children = new Node[26];
        boolean ends;
    }

    private final Node root = new Node();

    PrefixTree() {
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

    public boolean has(String word) {
        Node node = walk(word);
        return node != null && node.ends;
    }

    public boolean startsWith(String prefix) {
        return walk(prefix) != null;
    }

    private Node walk(String text) {
        Node node = root;
        for (int i = 0; i < text.length(); i++) {
            node = node.children[text.charAt(i) - 'a'];
            if (node == null) {
                return null;
            }
        }
        return node;
    }
}
