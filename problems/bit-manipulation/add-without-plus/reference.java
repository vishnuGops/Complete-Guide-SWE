import java.util.*;

class Solution {
    public int addThem(int first, int second) {
        // Two's complement is exactly the representation this assumes, so
        // negative values need no special case.
        while (second != 0) {
            int carry = (first & second) << 1;
            first = first ^ second;
            second = carry;
        }
        return first;
    }
}
