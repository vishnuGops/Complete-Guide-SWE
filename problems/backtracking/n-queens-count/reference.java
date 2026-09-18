import java.util.*;

class Solution {

    private int full;
    private int found;

    public int queenPlacements(int n) {
        full = (1 << n) - 1;
        found = 0;
        place(0, 0, 0);
        return found;
    }

    private void place(int columns, int down, int up) {
        if (columns == full) {
            found++;
            return;
        }
        // The columns this row may still use.
        int free = full & ~(columns | down | up);
        while (free != 0) {
            int bit = free & -free;     // the lowest free column
            free -= bit;
            place(columns | bit, ((down | bit) << 1) & full, (up | bit) >> 1);
        }
    }
}
