import java.util.*;

class Solution {
    public long[] productExceptSelf(int[] readings) {
        int n = readings.length;
        long[] out = new long[n];

        long running = 1;
        for (int i = 0; i < n; i++) {
            out[i] = running;
            running *= readings[i];
        }

        running = 1;
        for (int i = n - 1; i >= 0; i--) {
            out[i] *= running;
            running *= readings[i];
        }

        return out;
    }
}
