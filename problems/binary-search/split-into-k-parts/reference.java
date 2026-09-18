import java.util.*;

class Solution {
    public long fairestSplit(int[] loads, int k) {
        long low = 0;
        long high = 0;
        for (int load : loads) {
            low = Math.max(low, load);
            high += load;
        }

        while (low < high) {
            long mid = low + (high - low) / 2;
            if (workersNeeded(loads, mid) <= k) {
                high = mid;
            } else {
                low = mid + 1;
            }
        }

        return low;
    }

    /** The fewest runs whose totals all stay within `cap`. */
    private int workersNeeded(int[] loads, long cap) {
        int workers = 1;
        long running = 0;
        for (int load : loads) {
            if (running + load > cap) {
                workers++;
                running = load;
            } else {
                running += load;
            }
        }
        return workers;
    }
}
