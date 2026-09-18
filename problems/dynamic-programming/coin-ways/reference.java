import java.util.*;

class Solution {
    public int waysToMake(int[] coins, int amount) {
        int[] ways = new int[amount + 1];
        ways[0] = 1;   // one way to make nothing

        // Coins outside: each combination is assembled in one fixed order, so
        // it is counted once rather than once per ordering.
        for (int coin : coins) {
            for (int total = coin; total <= amount; total++) {
                ways[total] += ways[total - coin];
            }
        }

        return ways[amount];
    }
}
