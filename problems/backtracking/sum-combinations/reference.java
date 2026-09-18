import java.util.*;

class Solution {

    private int[] ordered;
    private final List<int[]> out = new ArrayList<>();
    private final List<Integer> chosen = new ArrayList<>();

    public int[][] waysToTotal(int[] values, int target) {
        ordered = values.clone();
        Arrays.sort(ordered);
        build(0, target);
        return out.toArray(new int[0][]);
    }

    private void build(int start, int remaining) {
        if (remaining == 0) {
            int[] combination = new int[chosen.size()];
            for (int i = 0; i < combination.length; i++) {
                combination[i] = chosen.get(i);
            }
            out.add(combination);
            return;
        }
        for (int index = start; index < ordered.length; index++) {
            int value = ordered[index];
            if (value > remaining) {
                // Sorted, so nothing later in the loop fits either.
                break;
            }
            chosen.add(value);
            // `index`, not `index + 1`: a value may be used again.
            build(index, remaining - value);
            chosen.remove(chosen.size() - 1);
        }
    }
}
