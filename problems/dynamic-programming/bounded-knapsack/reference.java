import java.util.*;

class Solution {
    public int bestLoad(int[] weights, int[] worths, int capacity) {
        int[] best = new int[capacity + 1];

        for (int index = 0; index < weights.length; index++) {
            int weight = weights[index];
            int worth = worths[index];
            // Downwards: the cell being read must not already include this item.
            for (int room = capacity; room >= weight; room--) {
                if (best[room - weight] + worth > best[room]) {
                    best[room] = best[room - weight] + worth;
                }
            }
        }

        return best[capacity];
    }
}
