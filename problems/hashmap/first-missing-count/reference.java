import java.util.*;

class Solution {
    public int smallestMissing(int[] counts) {
        int n = counts.length;

        for (int i = 0; i < n; i++) {
            // Send counts[i] home, and whatever was there home in its turn.
            // Comparing against the destination stops duplicates looping.
            while (counts[i] >= 1 && counts[i] <= n && counts[counts[i] - 1] != counts[i]) {
                int target = counts[i] - 1;
                int carried = counts[target];
                counts[target] = counts[i];
                counts[i] = carried;
            }
        }

        for (int i = 0; i < n; i++) {
            if (counts[i] != i + 1) {
                return i + 1;
            }
        }
        return n + 1;
    }
}
