import java.util.*;

class Solution {

    public int firstUnique(String text) {
        int[] counts = new int[26];
        for (int i = 0; i < text.length(); i++) {
            counts[text.charAt(i) - 'a']++;
        }
        for (int i = 0; i < text.length(); i++) {
            if (counts[text.charAt(i) - 'a'] == 1) {
                return i;
            }
        }
        return -1;
    }
}
