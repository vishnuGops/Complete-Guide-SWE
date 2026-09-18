import java.util.*;

class StackQueue {

    private final Deque<Integer> incoming = new ArrayDeque<>();
    private final Deque<Integer> outgoing = new ArrayDeque<>();

    StackQueue() {
    }

    public void push(int value) {
        incoming.push(value);
    }

    public int pop() {
        transfer();
        return outgoing.isEmpty() ? -1 : outgoing.pop();
    }

    public int peek() {
        transfer();
        return outgoing.isEmpty() ? -1 : outgoing.peek();
    }

    public boolean empty() {
        return incoming.isEmpty() && outgoing.isEmpty();
    }

    /** Only when the outgoing stack has drained, or the order breaks. */
    private void transfer() {
        if (outgoing.isEmpty()) {
            while (!incoming.isEmpty()) {
                outgoing.push(incoming.pop());
            }
        }
    }
}
