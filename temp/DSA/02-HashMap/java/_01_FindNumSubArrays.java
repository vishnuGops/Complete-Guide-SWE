/*
 * ============================================================
 * Problem (LeetCode 560 – Subarray Sum Equals K)
 * ============================================================
 * Objective  : Count the number of contiguous subarrays whose
 *              elements sum to exactly k.
 * Input      : int[] nums  – array of integers (may be negative)
 *              int    k    – target sum (any integer)
 * Output     : int         – count of subarrays with sum == k
 * Constraints: 1 <= nums.length <= 2 * 10^4
 *              -1000 <= nums[i] <= 1000
 *              -10^7 <= k <= 10^7
 * Example    : nums = [1, 2, 3], k = 3
 *              → 2   ([1,2] and [3] both sum to 3)
 *
 * ============================================================
 * Pattern : Prefix Sum + HashMap
 * Why it fits : We need counts of subarray sums without an
 *   O(n²) nested loop. Storing how many times each prefix sum
 *   has appeared lets us answer "how many left boundaries give
 *   sum == k ending here?" in O(1) per element.
 *
 * ============================================================
 * Core Idea
 * - Let prefix[i] = nums[0] + … + nums[i].
 * - Sum of subarray [l..r] = prefix[r] – prefix[l-1].
 * - We want prefix[r] – prefix[l-1] == k
 *   ⟹ prefix[l-1] == prefix[r] – k.
 * - Keep a frequency map of all prefix sums seen so far.
 * - Seed map with {0: 1} to handle subarrays starting at index 0.
 * - For each element, update curr, query map[curr – k], then
 *   record curr in the map.
 *
 * ============================================================
 * Step-by-Step Flow
 * 1. Initialize: map = {0:1}, curr = 0, ans = 0.
 * 2. For each num in nums:
 *    a. curr += num          (extend prefix sum)
 *    b. ans += map[curr – k] (subarrays ending here with sum k)
 *    c. map[curr]++          (record this prefix sum)
 * 3. Return ans.
 *
 * ============================================================
 * Correctness Intuition
 * Loop invariant: before processing index i, map contains the
 * frequency of every prefix sum prefix[j] for j in [-1, i-1]
 * (where prefix[-1] = 0). So map[curr – k] exactly counts the
 * number of valid left boundaries for a subarray ending at i.
 * Recording curr after the query prevents counting a zero-length
 * subarray (i.e., i == l – 1).
 *
 * ============================================================
 * Complexity
 * Time  : O(n)  – single pass; each map operation is O(1) avg.
 * Space : O(n)  – map stores at most n+1 distinct prefix sums.
 *
 * ============================================================
 * Optimization Notes
 * - Using HashMap instead of a sorted structure keeps both ops
 *   O(1) amortised vs O(log n).
 * - Early-exit is not applicable here (all elements must be seen
 *   because negatives can reset the prefix sum).
 * - If nums contained only non-negatives, a two-pointer/sliding
 *   window approach would also work in O(n) with O(1) space.
 *
 * ============================================================
 * Edge Cases
 * - Single-element array equal to k   → 1
 * - All zeros with k = 0              → n*(n+1)/2
 * - Negative numbers resetting prefix sum → handled correctly
 * - k = 0 with no zeros               → 0
 *
 * ============================================================
 * Pitfalls
 * - Forgetting to seed map with {0:1} misses subarrays that
 *   start at index 0.
 * - Querying map BEFORE updating it avoids counting empty/
 *   zero-length subarrays.
 * - Integer overflow: prefix sum can reach 2*10^4 * 1000 =
 *   2*10^7 — well within int range; no cast needed.
 *
 * ============================================================
 * Practice Extensions
 * 1. (LC 525) Contiguous Array – count subarrays with equal
 *    0s and 1s (map 0→-1, find prefix sum == 0).
 * 2. (LC 974) Subarray Sums Divisible by K – track prefix%k
 *    instead of prefix itself.
 * 3. (LC 1248) Count Number of Nice Subarrays – count
 *    subarrays with exactly k odd numbers.
 * 4. (LC 930) Binary Subarrays With Sum – same template on
 *    binary array.
 * ============================================================
 */

import java.util.HashMap;
import java.util.Map;

public class _01_FindNumSubArrays {

    /**
     * Returns the number of contiguous subarrays whose sum equals k.
     * Uses prefix-sum + frequency map: a subarray [l..r] has sum k
     * iff prefixSum[r] - prefixSum[l-1] == k.
     */
    public static int subarraySum(int[] nums, int k) {
        Map<Integer, Integer> prefixCount = new HashMap<>();
        prefixCount.put(0, 1); // empty prefix (before index 0)

        int ans = 0;
        int curr = 0;

        for (int num : nums) {
            curr += num;
            // how many left boundaries produce sum == k ending here
            ans += prefixCount.getOrDefault(curr - k, 0);
            // record current prefix sum AFTER querying (avoids zero-length subarray)
            prefixCount.merge(curr, 1, Integer::sum);
        }

        return ans;
    }

    // ----------------------------------------------------------
    // Time  : O(n)  – one pass through nums
    // Space : O(n)  – prefix-sum frequency map
    //
    // Alternative : Brute-force O(n²) with nested loops, O(1) space
    //   Trade-off  : simpler to reason about but TLEs on n ≥ 10^4
    //
    // Follow-ups  :
    //   • LC 525  – equal 0s and 1s (remap 0→-1)
    //   • LC 974  – sums divisible by K (use prefix % k)
    //   • LC 1248 – exactly k odd numbers
    //   • LC 930  – binary subarray with sum S
    // ----------------------------------------------------------

    public static void main(String[] args) {
        // Example 1: [1,2,3], k=3 → 2  ([1,2] and [3])
        System.out.println(subarraySum(new int[]{1, 2, 3}, 3));       // 2

        // Example 2: [1,1,1], k=2 → 2  ([1,1] at indices 0-1 and 1-2)
        System.out.println(subarraySum(new int[]{1, 1, 1}, 2));       // 2

        // Example 3: negatives — [-1,-1,1], k=-1 → 3
        System.out.println(subarraySum(new int[]{-1, -1, 1}, -1));    // 3

        // Example 4: all zeros, k=0 → 6  (n*(n+1)/2 for n=3)
        System.out.println(subarraySum(new int[]{0, 0, 0}, 0));       // 6
    }
}
