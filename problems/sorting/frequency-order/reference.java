import java.util.*;

class Solution {

    public int[] byFrequency(int[] values) {
        Map<Integer, Integer> counts = new HashMap<>();
        for (int value : values) {
            counts.merge(value, 1, Integer::sum);
        }

        List<Integer> distinct = new ArrayList<>(counts.keySet());
        distinct.sort((left, right) -> {
            int byCount = Integer.compare(counts.get(right), counts.get(left));
            return byCount != 0 ? byCount : Integer.compare(left, right);
        });

        int[] ordered = new int[distinct.size()];
        for (int i = 0; i < ordered.length; i++) {
            ordered[i] = distinct.get(i);
        }
        return ordered;
    }
}
