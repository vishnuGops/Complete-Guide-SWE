/*
 * ============================================================
 * PREFIX SUM — Template
 * ============================================================
 * PROBLEM (LeetCode 303 — Range Sum Query - Immutable)
 *   Objective: Preprocess an integer array so that any range sum
 *              query [left, right] can be answered in O(1).
 *   Input:     int[] nums — integers (can be negative), 1 <= n <= 10^4
 *              int left, right — 0-indexed inclusive range, left <= right
 *   Output:    int — sum of nums[left..right]
 *   Constraints:
 *     - 1 <= nums.length <= 10^4
 *     - -10^5 <= nums[i] <= 10^5
 *     - 0 <= left <= right < nums.length
 *     - Up to 10^4 queries after a single build
 *   Example:
 *     nums = [-2, 0, 3, -5, 2, -1]
 *     sumRange(0, 2) →  1   (-2 + 0 + 3)
 *     sumRange(2, 5) → -1   (3 - 5 + 2 - 1)
 *     sumRange(0, 5) → -3   (entire array)
 *
 * PATTERN: Prefix Sum
 *   Why it fits: repeated range sum queries on a static array.
 *   Brute-force O(n) per query becomes O(n * q) total — too slow for many
 *   queries. One O(n) precomputation lets every future query run in O(1)
 *   via a simple subtraction: prefix[right+1] - prefix[left].
 *
 * CORE IDEA
 *   1. Build prefix[0..n] where prefix[i] = sum of nums[0..i-1].
 *   2. prefix[0] = 0 (sentinel — empty prefix, simplifies boundary handling).
 *   3. prefix[i] = prefix[i-1] + nums[i-1] for i in [1..n].
 *   4. Range sum [left, right] = prefix[right+1] - prefix[left].
 *   5. The +1 offset on array size eliminates the if (left == 0) branch entirely.
 *
 * STEP-BY-STEP FLOW  (nums = [-2, 0, 3, -5, 2, -1])
 *   Build:    prefix = [0, -2, -2, 1, -4, -2, -3]   (length n+1 = 7)
 *   Query (0,2): prefix[3]  - prefix[0] =  1 - 0  =  1
 *   Query (2,5): prefix[6]  - prefix[2] = -3 - (-2) = -1
 *   Query (0,5): prefix[6]  - prefix[0] = -3 - 0  = -3
 *   Query (3,3): prefix[4]  - prefix[3] = -4 - 1  = -5  (single element)
 *
 * CORRECTNESS INTUITION
 *   prefix[i] = nums[0] + ... + nums[i-1]  (by construction).
 *   prefix[right+1] - prefix[left]
 *     = (nums[0]+...+nums[right]) - (nums[0]+...+nums[left-1])
 *     = nums[left] + ... + nums[right].   QED.
 *   The sentinel prefix[0]=0 makes the left==0 case identical to all others.
 *
 * COMPLEXITY
 *   Time:  O(n) build + O(1) per query — optimal for static arrays.
 *   Space: O(n) — prefix array of size n+1.
 *
 * OPTIMIZATION NOTES
 *   Current: 1-indexed prefix (size n+1) with sentinel prefix[0]=0.
 *     Pros: zero branch in query; cleaner code; standard interview form.
 *   Alternative: 0-indexed prefix (size n), prefix[i] = sum(0..i).
 *     sumRange = prefix[right] - (left > 0 ? prefix[left-1] : 0).
 *     Same asymptotic cost; the conditional is a common source of bugs.
 *
 * EDGE CASES
 *   - left == 0: prefix[0] = 0, so prefix[right+1] - 0 is correct with no branch.
 *   - left == right: prefix[right+1] - prefix[right] = nums[right]. Correct.
 *   - All negatives: prefix sums go monotonically down — handled transparently.
 *   - Overflow: n=10^4, nums[i]=10^5 → max sum ~10^9, fits in int. Use long[] if larger.
 *
 * PITFALLS
 *   - Off-by-one: query uses prefix[right+1], NOT prefix[right].
 *   - Mutating nums after build invalidates prefix — this is a static-array technique.
 *   - Forgetting the sentinel: a 0-indexed prefix (size n) breaks the left==0 case.
 *
 * PRACTICE EXTENSIONS
 *   1. LC 560  — Subarray Sum Equals K
 *              (prefix + hashmap; count subarrays with exact sum k)
 *   2. LC 238  — Product of Array Except Self
 *              (prefix product + suffix product; no division allowed)
 *   3. LC 304  — Range Sum Query 2D - Immutable
 *              (2D prefix sum; O(1) area queries over a sub-rectangle)
 *   4. LC 1480 — Running Sum of 1D Array
 *              (in-place prefix sum; warm-up variant)
 * ============================================================
 */
public class _04_PrefixSum {

    // Builds a 1-indexed prefix sum array: prefix[i] = sum of nums[0..i-1].
    // prefix[0] = 0 acts as a sentinel — no special case when left == 0.
    static int[] buildPrefix(int[] nums) {
        int n = nums.length;
        int[] prefix = new int[n + 1];              // prefix[0] = 0 implicitly
        for (int i = 1; i <= n; i++) {
            prefix[i] = prefix[i - 1] + nums[i - 1];
        }
        return prefix;
    }

    // O(1) inclusive range sum: sum of nums[left..right].
    static int sumRange(int[] prefix, int left, int right) {
        return prefix[right + 1] - prefix[left];
    }

    static void solve() {
        int[] nums = {-2, 0, 3, -5, 2, -1};
        int[] prefix = buildPrefix(nums);

        System.out.println(sumRange(prefix, 0, 2));   // →  1  (-2+0+3)
        System.out.println(sumRange(prefix, 2, 5));   // → -1  (3-5+2-1)
        System.out.println(sumRange(prefix, 0, 5));   // → -3  (all elements)
        System.out.println(sumRange(prefix, 3, 3));   // → -5  (single element)
    }

    public static void main(String[] args) {
        solve();
    }

    // Time:  O(n) build, O(1) per query — optimal for static array + many queries.
    // Space: O(n) — prefix array of size n+1; no other auxiliary storage.
    //
    // Alternative: 0-indexed prefix (size n), prefix[i] = sum(0..i).
    //   sumRange = prefix[right] - (left > 0 ? prefix[left-1] : 0).
    //   Same O(n)/O(1) profile; the conditional branch is a common bug source.
    //
    // Follow-up interview extensions:
    //   1. Subarray Sum Equals K (LC 560): for each right, check if any left gives
    //      prefix[right+1] - prefix[left] == k → use a frequency hashmap of prefix values.
    //   2. Mutable array (point updates): O(log n) update + query via Fenwick tree (BIT).
    //   3. 2D version (LC 304): build a 2D prefix table; any sub-rectangle sum in O(1).
    //   4. Maximum subarray sum — when is prefix sum better than Kadane's O(n) approach?
}
