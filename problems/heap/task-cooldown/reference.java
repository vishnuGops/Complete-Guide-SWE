import java.util.*;

class Solution {
    public int leastTime(String tasks, int cooldown) {
        int[] counts = new int[26];
        for (int i = 0; i < tasks.length(); i++) {
            counts[tasks.charAt(i) - 'a']++;
        }

        int most = 0;
        for (int count : counts) {
            most = Math.max(most, count);
        }
        int tied = 0;
        for (int count : counts) {
            if (count == most) {
                tied++;
            }
        }

        // The skeleton the most frequent task forces, plus one tick for every
        // task tied with it. Widened: (10^4 - 1) * (10^4 + 1) is near 10^8,
        // which fits, but the intermediate is worth not having to think about.
        long skeleton = (long) (most - 1) * (cooldown + 1) + tied;

        // If the gaps overflow there is no idling at all.
        return (int) Math.max(tasks.length(), skeleton);
    }
}
