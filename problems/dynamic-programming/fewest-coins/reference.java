import java.util.*;

class Solution {
    public int fewestCoins(int[] coins, int amount) {
        // Larger than any real answer, since every coin is at least 1.
        int unreachable = amount + 1;
        int[] fewest = new int[amount + 1];
        Arrays.fill(fewest, unreachable);
        fewest[0] = 0;

        for (int total = 1; total <= amount; total++) {
            for (int coin : coins) {
                if (coin <= total && fewest[total - coin] + 1 < fewest[total]) {
                    fewest[total] = fewest[total - coin] + 1;
                }
            }
        }

        return fewest[amount] == unreachable ? -1 : fewest[amount];
    }
}
