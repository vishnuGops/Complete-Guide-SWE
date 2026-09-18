import java.util.*;

class Solution {
    public int missingNumber(int[] values) {
        // Everything present appears in both collections and cancels.
        int answer = values.length;
        for (int index = 0; index < values.length; index++) {
            answer ^= index ^ values[index];
        }
        return answer;
    }
}
