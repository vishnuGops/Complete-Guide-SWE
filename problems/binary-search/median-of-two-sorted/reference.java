import java.util.*;

class Solution {
    public double medianOfTwo(int[] first, int[] second) {
        // Search over the shorter series, so that j stays inside [0, m].
        if (first.length > second.length) {
            int[] swapped = first;
            first = second;
            second = swapped;
        }

        int n = first.length;
        int m = second.length;
        int total = n + m;
        int half = (total + 1) / 2;

        int low = 0;
        int high = n;
        while (low <= high) {
            int i = low + (high - low) / 2;
            int j = half - i;

            long leftFirst = i > 0 ? first[i - 1] : Long.MIN_VALUE;
            long rightFirst = i < n ? first[i] : Long.MAX_VALUE;
            long leftSecond = j > 0 ? second[j - 1] : Long.MIN_VALUE;
            long rightSecond = j < m ? second[j] : Long.MAX_VALUE;

            if (leftFirst <= rightSecond && leftSecond <= rightFirst) {
                long lower = Math.max(leftFirst, leftSecond);
                if (total % 2 == 1) {
                    return lower;
                }
                long upper = Math.min(rightFirst, rightSecond);
                return (lower + upper) / 2.0;
            }
            if (leftFirst > rightSecond) {
                high = i - 1;
            } else {
                low = i + 1;
            }
        }

        // Unreachable while both series are sorted.
        throw new IllegalArgumentException("the series are not sorted");
    }
}
