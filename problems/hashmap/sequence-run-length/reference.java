import java.util.*;

class Solution {

    public int longestRun(int[] values) {
        Set<Integer> present = new HashSet<>();
        for (int value : values) {
            present.add(value);
        }

        int best = 0;
        for (int value : present) {
            if (present.contains(value - 1)) {
                continue;
            }
            int length = 1;
            while (present.contains(value + length)) {
                length++;
            }
            best = Math.max(best, length);
        }
        return best;
    }
}
