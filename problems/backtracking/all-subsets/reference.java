import java.util.*;

class Solution {

    private int[] values;
    private final List<int[]> out = new ArrayList<>();
    private final Deque<Integer> chosen = new ArrayDeque<>();

    public int[][] everySubset(int[] values) {
        this.values = values;
        build(0);
        return out.toArray(new int[0][]);
    }

    private void build(int at) {
        if (at == values.length) {
            int[] subset = new int[chosen.size()];
            int index = 0;
            for (int value : chosen) {
                subset[index++] = value;
            }
            out.add(subset);
            return;
        }
        build(at + 1);
        chosen.push(values[at]);
        build(at + 1);
        chosen.pop();
    }
}
