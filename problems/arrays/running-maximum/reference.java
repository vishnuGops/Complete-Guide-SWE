import java.util.*;

class Solution {
    public int[] runningMaximum(int[] readings) {
        int[] out = new int[readings.length];
        int best = readings[0];
        for (int i = 0; i < readings.length; i++) {
            if (readings[i] > best) {
                best = readings[i];
            }
            out[i] = best;
        }
        return out;
    }
}
