import java.util.*;

class Solution {
    public int theLonelyOne(int[] values) {
        // Pairs cancel, whatever order they appear in.
        int answer = 0;
        for (int value : values) {
            answer ^= value;
        }
        return answer;
    }
}
