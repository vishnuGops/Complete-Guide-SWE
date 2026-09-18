import java.util.*;

class Solution {
    public boolean isPowerOfTwo(int value) {
        // Positive, and exactly one bit set: clearing the lowest leaves nothing.
        return value > 0 && (value & (value - 1)) == 0;
    }
}
