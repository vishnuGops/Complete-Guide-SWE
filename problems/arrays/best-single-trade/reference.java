import java.util.*;

class Solution {
    public int bestTrade(int[] prices) {
        int cheapest = prices[0];
        int best = 0;
        for (int price : prices) {
            if (price - cheapest > best) {
                best = price - cheapest;
            }
            if (price < cheapest) {
                cheapest = price;
            }
        }
        return best;
    }
}
