import java.util.*;

class MinValueStack {

    private final Deque<Integer> values = new ArrayDeque<>();
    // Parallel stack: its top is the smallest value currently in `values`.
    private final Deque<Integer> mins = new ArrayDeque<>();

    MinValueStack() {
    }

    public void push(int value) {
        values.push(value);
        mins.push(mins.isEmpty() ? value : Math.min(value, mins.peek()));
    }

    public int pop() {
        mins.pop();
        return values.pop();
    }

    public int top() {
        return values.peek();
    }

    public int smallest() {
        return mins.peek();
    }
}
