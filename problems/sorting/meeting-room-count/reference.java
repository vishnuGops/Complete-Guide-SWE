import java.util.*;

class Solution {
    public int roomsAtOnce(int[][] bookings) {
        int n = bookings.length;
        int[] starts = new int[n];
        int[] ends = new int[n];
        for (int i = 0; i < n; i++) {
            starts[i] = bookings[i][0];
            ends[i] = bookings[i][1];
        }
        Arrays.sort(starts);
        Arrays.sort(ends);

        int released = 0;
        int inProgress = 0;
        int best = 0;

        for (int start : starts) {
            // A booking that ended at or before this start frees its room.
            while (ends[released] <= start) {
                released++;
                inProgress--;
            }
            inProgress++;
            if (inProgress > best) {
                best = inProgress;
            }
        }

        return best;
    }
}
