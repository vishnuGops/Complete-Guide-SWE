import java.util.*;

class Solution {

    public int minCapacity(int[] weights, int days) {
        int low = 0;
        int high = 0;
        for (int weight : weights) {
            low = Math.max(low, weight);
            high += weight;
        }

        while (low < high) {
            int mid = low + (high - low) / 2;
            if (daysNeeded(weights, mid) <= days) {
                high = mid;
            } else {
                low = mid + 1;
            }
        }
        return low;
    }

    private int daysNeeded(int[] weights, int capacity) {
        int used = 1;
        int carried = 0;
        for (int weight : weights) {
            if (carried + weight > capacity) {
                used++;
                carried = 0;
            }
            carried += weight;
        }
        return used;
    }
}
