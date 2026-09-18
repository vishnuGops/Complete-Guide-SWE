import java.util.*;

class Solution {
    public int fewestSwaps(int[] readings) {
        int n = readings.length;
        // home[i] is the position currently holding the reading that belongs
        // at position i.
        Integer[] home = new Integer[n];
        for (int i = 0; i < n; i++) {
            home[i] = i;
        }
        Arrays.sort(home, (left, right) -> Integer.compare(readings[left], readings[right]));

        boolean[] seen = new boolean[n];
        int swaps = 0;

        for (int start = 0; start < n; start++) {
            if (seen[start] || home[start] == start) {
                continue;
            }
            int length = 0;
            int at = start;
            while (!seen[at]) {
                seen[at] = true;
                at = home[at];
                length++;
            }
            swaps += length - 1;
        }

        return swaps;
    }
}
