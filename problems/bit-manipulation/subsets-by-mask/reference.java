import java.util.*;

class Solution {
    public int[][] subsetsInOrder(int[] values) {
        int n = values.length;
        int[][] out = new int[1 << n][];

        // Each number from 0 to 2^n - 1 names a different subset.
        for (int mask = 0; mask < (1 << n); mask++) {
            int size = Integer.bitCount(mask);
            int[] subset = new int[size];
            int at = 0;
            for (int index = 0; index < n; index++) {
                if ((mask >> index & 1) != 0) {
                    subset[at++] = values[index];
                }
            }
            out[mask] = subset;
        }

        return out;
    }
}
