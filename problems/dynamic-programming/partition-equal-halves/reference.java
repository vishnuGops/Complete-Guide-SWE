import java.util.*;

class Solution {
    public boolean canSplitEvenly(int[] values) {
        int total = 0;
        for (int value : values) {
            total += value;
        }
        if (total % 2 == 1) {
            return false;
        }
        int half = total / 2;

        boolean[] reachable = new boolean[half + 1];
        reachable[0] = true;   // the empty subset

        for (int value : values) {
            // Downwards: each value may be spent once, so the cell being read
            // must not already include it.
            for (int target = half; target >= value; target--) {
                if (reachable[target - value]) {
                    reachable[target] = true;
                }
            }
        }

        return reachable[half];
    }
}
