import java.util.*;

class Solution {

    public int peakWindowStart(int[] values, int width) {
        long total = 0;
        for (int i = 0; i < width; i++) {
            total += values[i];
        }
        long bestTotal = total;
        int bestStart = 0;
        for (int start = 1; start + width <= values.length; start++) {
            total += values[start + width - 1] - values[start - 1];
            if (total > bestTotal) {
                bestTotal = total;
                bestStart = start;
            }
        }
        return bestStart;
    }
}
