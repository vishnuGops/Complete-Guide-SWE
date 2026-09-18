import java.util.*;

class Suggester {

    private static final class Node {
        final Node[] children = new Node[26];
        boolean ends;
    }

    private final Node root = new Node();

    Suggester() {
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

    public String[] suggest(String prefix) {
        Node node = root;
        for (int i = 0; i < prefix.length(); i++) {
            node = node.children[prefix.charAt(i) - 'a'];
            if (node == null) {
                return new String[0];
            }
        }

        List<String> out = new ArrayList<>();
        collect(node, new StringBuilder(prefix), out);
        return out.toArray(new String[0]);
    }

    private void collect(Node node, StringBuilder sofar, List<String> out) {
        if (out.size() == 3) {
            return;
        }
        if (node.ends) {
            out.add(sofar.toString());
        }
        // The array is indexed by letter, so this walk is alphabetical.
        for (int letter = 0; letter < 26; letter++) {
            if (node.children[letter] != null) {
                sofar.append((char) ('a' + letter));
                collect(node.children[letter], sofar, out);
                sofar.deleteCharAt(sofar.length() - 1);
                if (out.size() == 3) {
                    return;
                }
            }
        }
    }
}
