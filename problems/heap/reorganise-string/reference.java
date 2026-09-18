import java.util.*;

class Solution {
    public String reorganise(String letters) {
        int[] counts = new int[26];
        for (int i = 0; i < letters.length(); i++) {
            counts[letters.charAt(i) - 'a']++;
        }

        // {count, letter}, most common first.
        PriorityQueue<int[]> heap =
                new PriorityQueue<>((left, right) -> Integer.compare(right[0], left[0]));
        for (int letter = 0; letter < 26; letter++) {
            if (counts[letter] > 0) {
                heap.offer(new int[] {counts[letter], letter});
            }
        }

        StringBuilder out = new StringBuilder(letters.length());
        int[] held = null;

        while (!heap.isEmpty()) {
            int[] entry = heap.poll();
            out.append((char) ('a' + entry[1]));
            // The letter used last step may be chosen again from now on.
            if (held != null) {
                heap.offer(held);
                held = null;
            }
            if (entry[0] > 1) {
                held = new int[] {entry[0] - 1, entry[1]};
            }
        }

        // A letter still held has copies with nowhere left to put them.
        return held != null ? "" : out.toString();
    }
}
