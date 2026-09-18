import java.util.*;

class Solution {
    public void sinkZeroes(int[] slots) {
        int write = 0;
        for (int read = 0; read < slots.length; read++) {
            if (slots[read] != 0) {
                int carried = slots[write];
                slots[write] = slots[read];
                slots[read] = carried;
                write++;
            }
        }
    }
}
