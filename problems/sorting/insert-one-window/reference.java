import java.util.*;

class Solution {
    public int[][] insertWindow(int[][] schedule, int[] added) {
        List<int[]> out = new ArrayList<>();
        int start = added[0];
        int end = added[1];
        int i = 0;
        int n = schedule.length;

        // Before: ends strictly before the new window starts.
        while (i < n && schedule[i][1] < start) {
            out.add(schedule[i]);
            i++;
        }

        // Meeting: starts at or before the new window ends.
        while (i < n && schedule[i][0] <= end) {
            start = Math.min(start, schedule[i][0]);
            end = Math.max(end, schedule[i][1]);
            i++;
        }
        out.add(new int[] {start, end});

        // After.
        while (i < n) {
            out.add(schedule[i]);
            i++;
        }

        return out.toArray(new int[0][]);
    }
}
