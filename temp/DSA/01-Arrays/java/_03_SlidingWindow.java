/*
 * ============================================================
 * SLIDING WINDOW — Variable-Width Template
 * ============================================================
 * PROBLEM (LeetCode 209 — Minimum Size Subarray Sum)
 *   Objective: Find the length of the shortest contiguous subarray
 *              whose sum >= target. Return 0 if no such subarray exists.
 *   Input:     int[] nums — positive integers, 1 <= nums[i] <= 10^4
 *              int target — 1 <= target <= 10^9
 *   Output:    int — minimum subarray length with sum >= target; 0 if none.
 *   Constraints:
 *     - 1 <= nums.length <= 10^5
 *     - All elements are positive (critical for window monotonicity).
 *   Example:
 *     nums = [2,3,1,2,4,3], target = 7 → 2  ([4,3], sum = 7)
 *     nums = [1,4,4],        target = 4 → 1  ([4])
 *     nums = [1,2,3],        target = 11 → 0  (no valid subarray)
 *
 * PATTERN: Variable-Width Sliding Window
 *   Why it fits: The window condition (sum >= target) is monotone with respect
 *   to window size when all values are positive. Expanding adds value;
 *   shrinking can only decrease the sum. We never need to restart.
 *
 * CORE IDEA
 *   1. Maintain windowSum = sum of elements in [left, right].
 *   2. Expand right pointer each iteration, adding nums[right] to windowSum.
 *   3. While the window is valid (sum >= target), record its length and
 *      shrink from the left — always capture the answer BEFORE shrinking.
 *   4. Track the minimum length across all valid windows seen.
 *   5. Return 0 if no valid window was ever found.
 *
 * STEP-BY-STEP FLOW  (nums=[2,3,1,2,4,3], target=7)
 *   right=0: sum=2  — not valid
 *   right=1: sum=5  — not valid
 *   right=2: sum=6  — not valid
 *   right=3: sum=8  — valid → ans=4, shrink: sum=6 (left=1)
 *   right=4: sum=10 — valid → ans=4, shrink: sum=7 (left=2) → valid → ans=3, shrink: sum=6 (left=3)
 *   right=5: sum=9  — valid → ans=3, shrink: sum=7 (left=4) → valid → ans=2, shrink: sum=3 (left=5)
 *   return 2
 *
 * CORRECTNESS INTUITION
 *   Loop invariant: windowSum == sum(nums[left..right]) at end of each right iteration.
 *   Because all values are positive, once windowSum falls below target after
 *   shrinking, only expanding right can restore validity. We never miss the
 *   optimal window: we greedily shrink as much as possible each time the
 *   window is valid, capturing the minimum length at each valid state.
 *
 * COMPLEXITY
 *   Time:  O(n) — each element is added by right exactly once, and removed
 *                 by left at most once → 2n pointer movements total.
 *   Space: O(1) — only scalar variables (sum, left, ans).
 *
 * OPTIMIZATION NOTES
 *   Current: single-pass O(n) two-pointer shrink — optimal for positive arrays.
 *   Alternative: prefix sums + binary search per right → O(n log n).
 *     Valid only when prefix sums are monotonically non-decreasing (non-negative
 *     elements). Strictly worse asymptotically; useful as a stepping-stone
 *     explanation in interviews.
 *
 * EDGE CASES
 *   - No element meets target alone and total sum < target → return 0.
 *   - Single element >= target → return 1.
 *   - All elements equal target → return 1.
 *   - nums.length == 1 and nums[0] < target → return 0.
 *
 * PITFALLS
 *   - Record ans BEFORE left++ — don't shrink first or you'll skip valid lengths.
 *   - Initialize ans = Integer.MAX_VALUE, not 0 — 0 is the "not found" sentinel.
 *   - Don't use this pattern on arrays with negative numbers: shrinking no longer
 *     guarantees sum decreases, breaking the greedy shrink logic.
 *
 * PRACTICE EXTENSIONS
 *   1. LC 3  — Longest Substring Without Repeating Characters
 *              (char-frequency map as window state; shrink when duplicate appears)
 *   2. LC 76 — Minimum Window Substring
 *              (two frequency maps; shrink while all chars are covered)
 *   3. LC 904 — Fruit Into Baskets
 *              (max window with at most 2 distinct values)
 *   4. LC 1004 — Max Consecutive Ones III
 *              (count zeros in window; shrink when zeros > k)
 * ============================================================
 */
public class _03_SlidingWindow {

    // Minimum Size Subarray Sum — variable-width sliding window.
    static int minSubarrayLen(int target, int[] nums) {
        int left = 0;
        int windowSum = 0;
        int ans = Integer.MAX_VALUE;           // sentinel: no valid window yet

        for (int right = 0; right < nums.length; right++) {
            windowSum += nums[right];          // expand: include nums[right]

            // Shrink from left while the window is still valid.
            // Record BEFORE shrinking to capture the current (minimal-so-far) length.
            while (windowSum >= target) {
                ans = Math.min(ans, right - left + 1);
                windowSum -= nums[left];
                left++;
            }
        }

        return (ans == Integer.MAX_VALUE) ? 0 : ans;
    }

    public static void main(String[] args) {
        System.out.println(minSubarrayLen(7, new int[]{2, 3, 1, 2, 4, 3}));  // → 2
        System.out.println(minSubarrayLen(4, new int[]{1, 4, 4}));            // → 1
        System.out.println(minSubarrayLen(11, new int[]{1, 2, 3}));           // → 0
    }

    // Time:  O(n)        — right moves n steps, left at most n steps total.
    // Space: O(1)        — no auxiliary data structure; constant scalar state.
    //
    // Alternative: prefix-sum + binary search per right index → O(n log n).
    //   Each right, binary-search prefix sums for first index where
    //   prefix[right+1] - prefix[i] >= target. Cleaner to reason about
    //   correctness but strictly slower; valid only for non-negative nums.
    //
    // Follow-up interview extensions:
    //   1. Array has negative numbers — how does the approach change?
    //      (Sliding window breaks; consider deque-based monotone approach or segment tree.)
    //   2. Return the actual subarray, not just its length.
    //   3. Count the number of subarrays with sum >= target in O(n).
    //   4. Generalize to a 2D matrix: find minimum-area sub-matrix with sum >= target.
}
