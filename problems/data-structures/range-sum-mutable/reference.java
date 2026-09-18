import java.util.*;

class SumTable {

    private final int[] values;
    private final int[] tree;

    SumTable(int[] readings) {
        values = readings.clone();
        // One longer, because the walk uses `at & -at` and that is 0 at index 0.
        tree = new int[readings.length + 1];
        for (int index = 0; index < readings.length; index++) {
            add(index + 1, readings[index]);
        }
    }

    public void set(int at, int value) {
        // The tree stores sums, so what is added is the difference.
        add(at + 1, value - values[at]);
        values[at] = value;
    }

    public int total(int start, int end) {
        return prefix(end + 1) - prefix(start);
    }

    private void add(int at, int delta) {
        while (at < tree.length) {
            tree[at] += delta;
            at += at & -at;
        }
    }

    private int prefix(int at) {
        int running = 0;
        while (at > 0) {
            running += tree[at];
            at -= at & -at;
        }
        return running;
    }
}
