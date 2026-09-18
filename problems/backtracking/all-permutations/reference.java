import java.util.*;

class Solution {

    private int[] values;
    private final List<int[]> out = new ArrayList<>();

    public int[][] everyOrdering(int[] values) {
        this.values = values.clone();
        build(0);
        return out.toArray(new int[0][]);
    }

    /** The swap version: the chosen value moves into place and back again. */
    private void build(int at) {
        if (at == values.length) {
            out.add(values.clone());
            return;
        }
        for (int index = at; index < values.length; index++) {
            swap(at, index);
            build(at + 1);
            swap(at, index);
        }
    }

    private void swap(int a, int b) {
        int carried = values[a];
        values[a] = values[b];
        values[b] = carried;
    }
}
