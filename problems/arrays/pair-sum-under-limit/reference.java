import java.util.*;

class Solution {

    public long countPairs(int[] weights, int limit) {
        int low = 0;
        int high = weights.length - 1;
        long pairs = 0;
        while (low < high) {
            if (weights[low] + weights[high] <= limit) {
                pairs += high - low;
                low++;
            } else {
                high--;
            }
        }
        return pairs;
    }
}
