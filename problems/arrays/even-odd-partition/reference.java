import java.util.*;

class Solution {

    public void partitionEvenFirst(int[] values) {
        int[] ordered = new int[values.length];
        int at = 0;
        for (int value : values) {
            if (value % 2 == 0) {
                ordered[at++] = value;
            }
        }
        for (int value : values) {
            if (value % 2 != 0) {
                ordered[at++] = value;
            }
        }
        System.arraycopy(ordered, 0, values, 0, values.length);
    }
}
