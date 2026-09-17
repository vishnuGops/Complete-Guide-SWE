import java.util.*;

class Solution {

    public int countDistinctPairs(int[] values, int gap) {
        Map<Integer, Integer> counts = new HashMap<>();
        for (int value : values) {
            counts.merge(value, 1, Integer::sum);
        }

        int pairs = 0;
        for (Map.Entry<Integer, Integer> entry : counts.entrySet()) {
            if (gap == 0) {
                if (entry.getValue() > 1) {
                    pairs++;
                }
            } else if (counts.containsKey(entry.getKey() + gap)) {
                pairs++;
            }
        }
        return pairs;
    }
}
