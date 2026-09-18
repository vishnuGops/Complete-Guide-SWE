import java.util.*;

class Solution {
    public String longestPalindrome(String word) {
        int n = word.length();
        int bestStart = 0;
        int bestLength = 1;

        // 2n - 1 centres: one on each letter, one between each pair.
        for (int centre = 0; centre < 2 * n - 1; centre++) {
            int left = centre / 2;
            int right = left + centre % 2;
            while (left >= 0 && right < n && word.charAt(left) == word.charAt(right)) {
                // Strictly longer, so the earliest of a tie is kept.
                if (right - left + 1 > bestLength) {
                    bestLength = right - left + 1;
                    bestStart = left;
                }
                left--;
                right++;
            }
        }

        return word.substring(bestStart, bestStart + bestLength);
    }
}
