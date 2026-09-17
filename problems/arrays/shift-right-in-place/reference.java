import java.util.*;

class Solution {
    public void shiftRight(int[] values, int shift) {
        int n = values.length;
        if (n == 0) {
            return;
        }
        shift %= n;
        if (shift == 0) {
            return;
        }
        reverse(values, 0, n - 1);
        reverse(values, 0, shift - 1);
        reverse(values, shift, n - 1);
    }

    private void reverse(int[] values, int lo, int hi) {
        while (lo < hi) {
            int tmp = values[lo];
            values[lo] = values[hi];
            values[hi] = tmp;
            lo++;
            hi--;
        }
    }
}
