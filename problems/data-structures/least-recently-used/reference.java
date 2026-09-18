import java.util.*;

class RecentCache {

    private static final class Node {
        final int key;
        int value;
        Node before;
        Node after;

        Node(int key, int value) {
            this.key = key;
            this.value = value;
        }
    }

    private final int capacity;
    private final Map<Integer, Node> byKey = new HashMap<>();
    // Dummy ends, so unlinking and inserting need no null checks.
    private final Node head = new Node(0, 0);
    private final Node tail = new Node(0, 0);

    RecentCache(int capacity) {
        this.capacity = capacity;
        head.after = tail;
        tail.before = head;
    }

    public int get(int key) {
        Node node = byKey.get(key);
        if (node == null) {
            return -1;
        }
        unlink(node);
        pushFront(node);
        return node.value;
    }

    public void put(int key, int value) {
        Node node = byKey.get(key);
        if (node != null) {
            node.value = value;
            unlink(node);
            pushFront(node);
            return;
        }

        if (byKey.size() == capacity) {
            Node oldest = tail.before;
            unlink(oldest);
            // The node carries its key, because the map entry has to go too.
            byKey.remove(oldest.key);
        }

        Node fresh = new Node(key, value);
        byKey.put(key, fresh);
        pushFront(fresh);
    }

    private void unlink(Node node) {
        node.before.after = node.after;
        node.after.before = node.before;
    }

    private void pushFront(Node node) {
        node.after = head.after;
        node.before = head;
        head.after.before = node;
        head.after = node;
    }
}
