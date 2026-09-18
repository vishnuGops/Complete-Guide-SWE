import java.util.*;

class Solution {
    public int cancellingStretches(int[] changes) {
        // The moment before the first change, whose running total is zero.
        Map<Long, Integer> seen = new HashMap<>();
        seen.put(0L, 1);
        long running = 0;
        int found = 0;

        for (int change : changes) {
            running += change;
            Integer before = seen.get(running);
            if (before != null) {
                found += before;
                seen.put(running, before + 1);
            } else {
                seen.put(running, 1);
            }
        }

        return found;
    }
}
