/*
 * Problem (LeetCode style):
 * Objective:
 * Find the maximum amount of water a container can store using any two lines.
 *
 * Input:
 * An integer array arr where arr[i] is the height of the i-th vertical line.
 *
 * Output:
 * Return one integer: the maximum area formed by choosing two indices i and j.
 *
 * Constraints:
 * - 2 <= arr.length <= 10^5
 * - 0 <= arr[i] <= 10^4
 *
 * Example:
 * Input:  arr = [1, 8, 6, 2, 5, 4, 8, 3, 7]
 * Output: 49
 * Explanation: Best pair is heights 8 and 7 with width 7, so area = 7 * 7 = 49.
 *
 * Pattern (and why it fits):
 * Two Pointers - One Input, Opposite Ends.
 * We evaluate pairs from both ends and discard provably non-optimal boundaries.
 *
 * Core Idea:
 * - Start with widest width using left=0 and right=n-1.
 * - Compute area as width * min(arr[left], arr[right]).
 * - Track maximum area seen so far.
 * - Move only the shorter boundary inward because it is the bottleneck.
 * - Continue until pointers meet.
 *
 * Step-by-Step Flow:
 * 1. Initialize ans=0, left=0, right=n-1.
 * 2. Compute current area using current pair.
 * 3. Update ans with max(ans, currentArea).
 * 4. Move shorter side pointer inward.
 * 5. Stop when left >= right.
 *
 * Correctness Intuition:
 * Loop invariant: ans is the best area among all pairs already checked.
 * If arr[left] <= arr[right], moving right inward keeps or reduces width and cannot
 * raise limiting height above arr[left], so no better area exists with current left.
 * Thus moving left is the only move that can improve the answer. Symmetric when
 * arr[right] < arr[left].
 *
 * Complexity:
 * - Time: O(n), each pointer moves inward at most n steps total.
 * - Space: O(1), only constant extra variables are used.
 *
 * Optimization Notes:
 * - This is asymptotically optimal for this problem.
 * - Optional micro-optimization: skip consecutive non-improving heights after
 *   pointer moves; same Big-O but slightly fewer comparisons.
 *
 * Edge Cases:
 * - Minimum size array of length 2.
 * - Heights containing zeros.
 * - All equal heights.
 * - Strictly increasing or strictly decreasing heights.
 *
 * Pitfalls:
 * - Moving the taller pointer instead of the shorter pointer.
 * - Using max(heightLeft, heightRight) instead of min(...).
 * - Off-by-one width calculation mistakes.
 * - Updating pointers before computing current area.
 *
 * Practice Extensions:
 * - Return indices of the pair that gives maximum area.
 * - Trapping Rain Water (related two-pointer reasoning).
 * - Maximize score of a good subarray (window + boundary reasoning).
 */
public class _01_TwoPointersOneInputOppositeEnds {
    public int fn(int[] arr) {
        int ans = 0;
        int left = 0;
        int right = arr.length - 1;

        while (left < right) {
            int width = right - left;
            int height = Math.min(arr[left], arr[right]);
            int currentArea = width * height;
            ans = Math.max(ans, currentArea);

            // Move the bottleneck side to potentially increase limiting height.
            if (arr[left] < arr[right]) {
                left++;
            } else {
                right--;
            }
        }

        return ans;
    }

    static void solve() {
        int[] arr = {1, 8, 6, 2, 5, 4, 8, 3, 7};
        _01_TwoPointersOneInputOppositeEnds solver = new _01_TwoPointersOneInputOppositeEnds();
        int answer = solver.fn(arr);

        System.out.println("Input heights: [1, 8, 6, 2, 5, 4, 8, 3, 7]");
        System.out.println("Maximum water area: " + answer); // Expected: 49

    }

    public static void main(String[] args) {
        solve();
    }
}

/*
 * Alternative approach:
 * - Brute force every pair in O(n^2) time and O(1) space.
 * - Two pointers is preferred because it reduces time to O(n) with same space.
 *
 * Interview follow-ups:
 * 1. Prove correctness formally with contradiction.
 * 2. Return both max area and pair indices.
 * 3. Adapt if one update operation changes a height online.
 */
