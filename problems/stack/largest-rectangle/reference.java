import java.util.*;

class Solution {
    public int widestBlock(int[] heights) {
        int n = heights.length;
        int best = 0;
        // Positions whose right boundary is unknown, in increasing height.
        Deque<Integer> waiting = new ArrayDeque<>();

        for (int i = 0; i <= n; i++) {
            // A sentinel of height 0 settles whatever is still waiting.
            int current = i < n ? heights[i] : 0;
            while (!waiting.isEmpty() && heights[waiting.peek()] >= current) {
                int height = heights[waiting.pop()];
                int left = waiting.isEmpty() ? 0 : waiting.peek() + 1;
                int area = height * (i - left);
                if (area > best) {
                    best = area;
                }
            }
            waiting.push(i);
        }

        return best;
    }
}
