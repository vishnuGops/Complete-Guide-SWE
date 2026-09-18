import java.util.*;

class StreamChecker {

    private static final class Node {
        final Node[] children = new Node[26];
        boolean ends;
    }

    private final Node root = new Node();
    private final Deque<Character> stream = new ArrayDeque<>();
    private int longest;

    StreamChecker(String[] words) {
        for (String word : words) {
            longest = Math.max(longest, word.length());
            Node node = root;
            // Stored backwards: a suffix read backwards is a prefix.
            for (int i = word.length() - 1; i >= 0; i--) {
                int letter = word.charAt(i) - 'a';
                if (node.children[letter] == null) {
                    node.children[letter] = new Node();
                }
                node = node.children[letter];
            }
            node.ends = true;
        }
    }

    public boolean next(String letter) {
        stream.addLast(letter.charAt(0));
        // Nothing older than the longest word can be part of a match.
        if (stream.size() > longest) {
            stream.removeFirst();
        }

        Node node = root;
        Iterator<Character> backwards = stream.descendingIterator();
        while (backwards.hasNext()) {
            Node child = node.children[backwards.next() - 'a'];
            if (child == null) {
                return false;
            }
            if (child.ends) {
                return true;
            }
            node = child;
        }

        return false;
    }
}
