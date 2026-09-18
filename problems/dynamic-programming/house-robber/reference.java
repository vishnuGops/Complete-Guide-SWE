import java.util.*;

class Solution {
    public int bestHaul(int[] houses) {
        // The best up to two houses back, and up to one house back.
        int twoBack = 0;
        int oneBack = 0;

        for (int amount : houses) {
            int best = Math.max(oneBack, twoBack + amount);
            twoBack = oneBack;
            oneBack = best;
        }

        return oneBack;
    }
}
