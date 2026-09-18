import java.util.*;

class Solution {
    public int waysToRead(String digits) {
        // Only the last two counts are ever read.
        int twoBack = 1;                                   // one way to read nothing
        int oneBack = digits.charAt(0) != '0' ? 1 : 0;

        for (int at = 1; at < digits.length(); at++) {
            int count = 0;
            if (digits.charAt(at) != '0') {
                count += oneBack;
            }
            int pair = (digits.charAt(at - 1) - '0') * 10 + (digits.charAt(at) - '0');
            if (pair >= 10 && pair <= 26) {
                count += twoBack;
            }
            twoBack = oneBack;
            oneBack = count;
        }

        return oneBack;
    }
}
