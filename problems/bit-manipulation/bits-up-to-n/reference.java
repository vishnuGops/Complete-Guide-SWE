import java.util.*;

class Solution {
    public int[] bitsUpTo(int n) {
        int[] answer = new int[n + 1];
        for (int value = 1; value <= n; value++) {
            // `value & (value - 1)` is `value` with its lowest set bit removed,
            // and is therefore smaller and already answered.
            answer[value] = answer[value & (value - 1)] + 1;
        }
        return answer;
    }
}
