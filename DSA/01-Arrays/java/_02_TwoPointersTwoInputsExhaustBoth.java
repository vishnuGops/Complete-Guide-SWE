/*
 * Problem (LeetCode style):
 * Objective:
 * Given two sorted integer arrays, return how many elements are common between them,
 * counting duplicates.
 *
 * Input:
 * - arr1: sorted int[]
 * - arr2: sorted int[]
 *
 * Output:
 * - int ans: number of common occurrences across both arrays.
 *
 * Constraints:
 * - 0 <= arr1.length, arr2.length <= 10^5
 * - Arrays are sorted in non-decreasing order.
 * - Values can be negative or positive.
 *
 * Example:
 * Input:  arr1 = [1, 2, 2, 3, 5, 8], arr2 = [2, 2, 2, 3, 4, 8, 10]
 * Output: 4
 * Explanation: Common occurrences are [2, 2, 3, 8].
 *
 * Pattern (and why it fits):
 * Two Pointers - Two Inputs, Exhaust Both.
 * Because both arrays are sorted, comparing current heads tells us which pointer can
 * be advanced safely without missing potential matches.
 *
 * Core Idea:
 * - Use i for arr1 and j for arr2.
 * - If arr1[i] == arr2[j], one common occurrence is found.
 * - If arr1[i] < arr2[j], advance i (arr1[i] cannot match later arr2 values).
 * - If arr1[i] > arr2[j], advance j (arr2[j] cannot match later arr1 values).
 * - Continue until one array is exhausted.
 *
 * Step-by-Step Flow:
 * 1. Initialize i=0, j=0, ans=0.
 * 2. Compare arr1[i] and arr2[j].
 * 3. On equal values, increment ans and both pointers.
 * 4. Otherwise move the pointer pointing to smaller value.
 * 5. Stop when i reaches arr1.length or j reaches arr2.length.
 *
 * Correctness Intuition:
 * Loop invariant: ans equals the number of common occurrences in prefixes
 * arr1[0..i-1] and arr2[0..j-1].
 * When arr1[i] < arr2[j], arr1[i] cannot match any future arr2 element because
 * arr2 is sorted and all future elements are >= arr2[j]. So advancing i is safe.
 * Symmetric reasoning applies when arr2[j] < arr1[i].
 *
 * Complexity:
 * - Time: O(n + m), each pointer moves forward at most once per element.
 * - Space: O(1), constant extra memory.
 *
 * Optimization Notes:
 * - This is optimal for sorted arrays.
 * - For unsorted arrays, sorting first gives O(n log n + m log m); a hash map can
 *   also be used in O(n + m) average time with extra space.
 *
 * Edge Cases:
 * - Either array empty.
 * - No overlap between arrays.
 * - All elements overlap.
 * - Heavy duplicates.
 *
 * Pitfalls:
 * - Forgetting to move both pointers on equality.
 * - Using this approach on unsorted arrays without preprocessing.
 * - Off-by-one errors in loop bounds.
 *
 * Practice Extensions:
 * - Return the full intersection list (with duplicates).
 * - Return unique intersection only.
 * - Extend to k sorted arrays.
 */
public class _02_TwoPointersTwoInputsExhaustBoth {
    public int fn(int[] arr1, int[] arr2) {
        int i = 0;
        int j = 0;
        int ans = 0;

        while (i < arr1.length && j < arr2.length) {
            if (arr1[i] == arr2[j]) {
                ans++;
                i++;
                j++;
            } else if (arr1[i] < arr2[j]) {
                i++;
            } else {
                j++;
            }
        }

        while (i < arr1.length) {
            i++;
        }

        while (j < arr2.length) {
            j++;
        }

        return ans;
    }

    static void solve() {
        int[] arr1 = {1, 2, 2, 3, 5, 8};
        int[] arr2 = {2, 2, 2, 3, 4, 8, 10};

        _02_TwoPointersTwoInputsExhaustBoth solver = new _02_TwoPointersTwoInputsExhaustBoth();
        int answer = solver.fn(arr1, arr2);

        System.out.println("arr1: [1, 2, 2, 3, 5, 8]");
        System.out.println("arr2: [2, 2, 2, 3, 4, 8, 10]");
        System.out.println("Common elements count (with duplicates): " + answer); // Expected: 4
    }

    public static void main(String[] args) {
        solve();
    }
}

/*
 * Alternative approach:
 * - Frequency map for one array + scan second array.
 * - Time: O(n + m) average, Space: O(min(n, m)).
 * - Two pointers is preferred here because input is already sorted and we keep O(1) space.
 *
 * Interview follow-ups:
 * 1. Return index pairs of matches.
 * 2. Find common elements across three sorted arrays.
 * 3. Handle streaming updates to one array.
 */
