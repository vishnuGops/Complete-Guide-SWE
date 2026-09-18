import java.util.*;

class Solution {
    public int theOddOneOut(int[] values) {
        // Bits seen once so far, and bits seen twice. A bit reaching three is
        // cleared from both, so every position counts modulo three at once.
        int ones = 0;
        int twos = 0;

        for (int value : values) {
            ones = (ones ^ value) & ~twos;
            twos = (twos ^ value) & ~ones;
        }

        return ones;
    }
}
