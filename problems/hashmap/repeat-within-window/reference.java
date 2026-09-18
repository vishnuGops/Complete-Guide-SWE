import java.util.*;

class Solution {
    public boolean hasRepeatWithin(int[] readings, int k) {
        Map<Integer, Integer> lastSeen = new HashMap<>();
        for (int index = 0; index < readings.length; index++) {
            Integer previous = lastSeen.get(readings[index]);
            if (previous != null && index - previous <= k) {
                return true;
            }
            lastSeen.put(readings[index], index);
        }
        return false;
    }
}
