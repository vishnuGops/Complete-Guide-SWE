import java.util.*;

class Solution {
    public int shortestTrip(int[][] distance) {
        int n = distance.length;
        if (n == 1) {
            return 0;
        }

        final int unreachable = 1000000000;
        int full = 1 << n;
        // best[visited][at]: the cheapest way to have visited that set and be
        // standing in `at`. The order of the visits does not matter.
        int[][] best = new int[full][n];
        for (int[] row : best) {
            Arrays.fill(row, unreachable);
        }
        best[1][0] = 0;

        for (int visited = 0; visited < full; visited++) {
            if ((visited & 1) == 0) {
                continue;
            }
            for (int at = 0; at < n; at++) {
                int cost = best[visited][at];
                if (cost == unreachable || (visited >> at & 1) == 0) {
                    continue;
                }
                for (int next = 0; next < n; next++) {
                    if ((visited >> next & 1) != 0) {
                        continue;
                    }
                    int onwards = visited | 1 << next;
                    if (cost + distance[at][next] < best[onwards][next]) {
                        best[onwards][next] = cost + distance[at][next];
                    }
                }
            }
        }

        int everywhere = full - 1;
        int answer = unreachable;
        for (int at = 0; at < n; at++) {
            answer = Math.min(answer, best[everywhere][at] + distance[at][0]);
        }
        return answer;
    }
}
