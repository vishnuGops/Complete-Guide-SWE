import java.util.*;

class Solution {
    public int[] pairSumIndex(int[] values, int target) {
        Map<Integer, Integer> seen = new HashMap<>();
        for (int i = 0; i < values.length; i++) {
            Integer earlier = seen.get(target - values[i]);
            if (earlier != null) {
                return new int[] { earlier, i };
            }
            seen.putIfAbsent(values[i], i);
        }
        return new int[0];
    }
}
