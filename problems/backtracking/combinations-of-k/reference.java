import java.util.*;

class Solution {

    private int n;
    private int k;
    private final List<int[]> out = new ArrayList<>();
    private int[] chosen;
    private int taken;

    public int[][] chooseK(int n, int k) {
        this.n = n;
        this.k = k;
        this.chosen = new int[k];
        this.taken = 0;
        build(1);
        return out.toArray(new int[0][]);
    }

    private void build(int start) {
        if (taken == k) {
            out.add(Arrays.copyOf(chosen, k));
            return;
        }
        // Leave enough numbers behind to finish the choice.
        int last = n - (k - taken) + 1;
        for (int value = start; value <= last; value++) {
            chosen[taken++] = value;
            build(value + 1);
            taken--;
        }
    }
}
