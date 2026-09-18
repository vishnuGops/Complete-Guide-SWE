import java.util.*;

class Solution {
    public int largestRunSum(int[] values) {
        int bestHere = values[0];
        int best = values[0];
        for (int i = 1; i < values.length; i++) {
            bestHere = Math.max(values[i], bestHere + values[i]);
            best = Math.max(best, bestHere);
        }
        return best;
    }
}
