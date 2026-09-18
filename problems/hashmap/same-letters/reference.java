import java.util.*;

class Solution {
    public boolean sameLetters(String first, String second) {
        if (first.length() != second.length()) {
            return false;
        }

        int[] tally = new int[26];
        for (int i = 0; i < first.length(); i++) {
            tally[first.charAt(i) - 'a']++;
        }
        for (int i = 0; i < second.length(); i++) {
            if (--tally[second.charAt(i) - 'a'] < 0) {
                return false;
            }
        }
        return true;
    }
}
