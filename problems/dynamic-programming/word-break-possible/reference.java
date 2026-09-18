import java.util.*;

class Solution {
    public boolean canBeRead(String letters, String[] dictionary) {
        Set<String> words = new HashSet<>(Arrays.asList(dictionary));
        int longest = 0;
        for (String word : dictionary) {
            longest = Math.max(longest, word.length());
        }

        int n = letters.length();
        boolean[] reachable = new boolean[n + 1];
        reachable[0] = true;   // no letters, read with no words

        for (int end = 1; end <= n; end++) {
            // No point looking back further than the longest word.
            int start = Math.max(0, end - longest);
            for (int begin = start; begin < end; begin++) {
                if (reachable[begin] && words.contains(letters.substring(begin, end))) {
                    reachable[end] = true;
                    break;
                }
            }
        }

        return reachable[n];
    }
}
