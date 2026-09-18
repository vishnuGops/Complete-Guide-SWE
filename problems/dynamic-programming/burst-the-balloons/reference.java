import java.util.*;

class Solution {
    public int bestBurst(int[] balloons) {
        // A 1 at each end, so a missing neighbour is an ordinary cell.
        int n = balloons.length + 2;
        int[] padded = new int[n];
        padded[0] = 1;
        padded[n - 1] = 1;
        for (int i = 0; i < balloons.length; i++) {
            padded[i + 1] = balloons[i];
        }

        // best[left][right]: the balloons strictly between them, all burst.
        int[][] best = new int[n][n];

        // By increasing gap, so both halves are known before the whole.
        for (int gap = 2; gap < n; gap++) {
            for (int left = 0; left + gap < n; left++) {
                int right = left + gap;
                for (int last = left + 1; last < right; last++) {
                    int score = best[left][last] + best[last][right]
                            + padded[left] * padded[last] * padded[right];
                    if (score > best[left][right]) {
                        best[left][right] = score;
                    }
                }
            }
        }

        return best[0][n - 1];
    }
}
