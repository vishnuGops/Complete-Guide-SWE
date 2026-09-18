import java.util.*;

class Solution {
    public int countOnes(int value) {
        int count = 0;
        while (value != 0) {
            // Clears exactly the lowest set bit.
            value &= value - 1;
            count++;
        }
        return count;
    }
}
