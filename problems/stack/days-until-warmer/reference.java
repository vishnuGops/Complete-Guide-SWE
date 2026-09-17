import java.util.*;

class Solution {

    public int[] daysUntilWarmer(int[] temperatures) {
        int[] waits = new int[temperatures.length];
        Deque<Integer> waiting = new ArrayDeque<>();
        for (int day = 0; day < temperatures.length; day++) {
            while (!waiting.isEmpty() && temperatures[waiting.peek()] < temperatures[day]) {
                int earlier = waiting.pop();
                waits[earlier] = day - earlier;
            }
            waiting.push(day);
        }
        return waits;
    }
}
