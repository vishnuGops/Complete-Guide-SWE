import java.util.*;

class Solution {
    public int waterHeld(int[] heights) {
        int left = 0;
        int right = heights.length - 1;
        int leftMax = 0;
        int rightMax = 0;
        int total = 0;

        while (left < right) {
            // The shorter side is the one whose wall is binding, so its water
            // is already decided.
            if (heights[left] < heights[right]) {
                leftMax = Math.max(leftMax, heights[left]);
                total += leftMax - heights[left];
                left++;
            } else {
                rightMax = Math.max(rightMax, heights[right]);
                total += rightMax - heights[right];
                right--;
            }
        }

        return total;
    }
}
