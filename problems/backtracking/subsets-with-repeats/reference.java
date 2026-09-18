import java.util.*;

class Solution {

    private int[] ordered;
    private final List<int[]> out = new ArrayList<>();
    private final List<Integer> chosen = new ArrayList<>();

    public int[][] distinctSubsets(int[] values) {
        ordered = values.clone();
        Arrays.sort(ordered);
        build(0);
        return out.toArray(new int[0][]);
    }

    private void build(int start) {
        int[] subset = new int[chosen.size()];
        for (int i = 0; i < subset.length; i++) {
            subset[i] = chosen.get(i);
        }
        out.add(subset);

        for (int index = start; index < ordered.length; index++) {
            // Only the first of a run of equal values may be entered here.
            if (index > start && ordered[index] == ordered[index - 1]) {
                continue;
            }
            chosen.add(ordered[index]);
            build(index + 1);
            chosen.remove(chosen.size() - 1);
        }
    }
}
