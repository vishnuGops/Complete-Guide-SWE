import java.util.*;

class Solution {
    public int[] nextGreaterWrapping(int[] readings) {
        int n = readings.length;
        int[] answer = new int[n];
        Arrays.fill(answer, -1);
        // Positions whose answer is still unknown, in decreasing value order.
        Deque<Integer> waiting = new ArrayDeque<>();

        for (int step = 0; step < 2 * n; step++) {
            int position = step % n;
            while (!waiting.isEmpty() && readings[waiting.peek()] < readings[position]) {
                answer[waiting.pop()] = readings[position];
            }
            if (step < n) {
                waiting.push(position);
            }
        }

        return answer;
    }
}
