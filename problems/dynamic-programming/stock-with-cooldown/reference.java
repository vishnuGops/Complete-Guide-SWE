import java.util.*;

class Solution {
    public int bestProfit(int[] prices) {
        // Owning an item on day zero is impossible, not free.
        int holding = -1000000000;
        int sold = 0;
        int free = 0;

        for (int price : prices) {
            // All three read yesterday's values, so they are saved first.
            int heldBefore = holding;
            int soldBefore = sold;
            int freeBefore = free;

            holding = Math.max(heldBefore, freeBefore - price);
            sold = heldBefore + price;
            free = Math.max(freeBefore, soldBefore);
        }

        return Math.max(sold, free);
    }
}
