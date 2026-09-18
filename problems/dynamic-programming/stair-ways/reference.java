import java.util.*;

class Solution {
    public int waysUp(int n) {
        // Only the last two values are ever needed.
        int twoBack = 1;   // ways to reach step 0
        int oneBack = 1;   // ways to reach step 1
        if (n == 0) {
            return twoBack;
        }

        for (int step = 2; step <= n; step++) {
            int next = oneBack + twoBack;
            twoBack = oneBack;
            oneBack = next;
        }

        return oneBack;
    }
}
