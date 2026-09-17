import java.util.*;

class Solution {

    public int[][] mergeWindows(int[][] windows) {
        if (windows.length == 0) {
            return new int[0][];
        }

        int[][] sorted = windows.clone();
        Arrays.sort(sorted, Comparator.comparingInt(window -> window[0]));

        List<int[]> merged = new ArrayList<>();
        for (int[] window : sorted) {
            int[] last = merged.isEmpty() ? null : merged.get(merged.size() - 1);
            if (last != null && window[0] <= last[1]) {
                last[1] = Math.max(last[1], window[1]);
            } else {
                merged.add(new int[] {window[0], window[1]});
            }
        }
        return merged.toArray(new int[0][]);
    }
}
