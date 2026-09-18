import java.util.*;

class Solution {
    public int[] theTwoLonelyOnes(int[] values) {
        int both = 0;
        for (int value : values) {
            both ^= value;
        }

        // A bit where the two lonely values differ, isolated.
        int bit = both & -both;

        int first = 0;
        for (int value : values) {
            if ((value & bit) != 0) {
                first ^= value;
            }
        }

        int second = both ^ first;
        return first < second ? new int[] {first, second} : new int[] {second, first};
    }
}
