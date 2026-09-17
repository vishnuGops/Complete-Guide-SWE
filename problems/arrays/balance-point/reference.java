import java.util.*;

class Solution {

    public int balancePoint(int[] values) {
        long total = 0;
        for (int value : values) {
            total += value;
        }
        long left = 0;
        for (int index = 0; index < values.length; index++) {
            if (left == total - left - values[index]) {
                return index;
            }
            left += values[index];
        }
        return -1;
    }
}
