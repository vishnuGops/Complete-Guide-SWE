import java.util.*;

class Solution {

    public int longestStretch(int[] values, int limit) {
        Map<Integer, Integer> counts = new HashMap<>();
        int best = 0;
        int left = 0;
        for (int right = 0; right < values.length; right++) {
            counts.merge(values[right], 1, Integer::sum);
            while (counts.size() > limit) {
                int leaving = values[left];
                int remaining = counts.get(leaving) - 1;
                if (remaining == 0) {
                    counts.remove(leaving);
                } else {
                    counts.put(leaving, remaining);
                }
                left++;
            }
            best = Math.max(best, right - left + 1);
        }
        return best;
    }
}
