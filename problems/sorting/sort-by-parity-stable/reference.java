import java.util.*;

class Solution {
    public int[] evensFirst(int[] readings) {
        int[] out = new int[readings.length];
        int at = 0;

        for (int reading : readings) {
            // `% 2 == 1` is false for negative odd numbers; compare against 0.
            if (reading % 2 == 0) {
                out[at++] = reading;
            }
        }
        for (int reading : readings) {
            if (reading % 2 != 0) {
                out[at++] = reading;
            }
        }

        return out;
    }
}
