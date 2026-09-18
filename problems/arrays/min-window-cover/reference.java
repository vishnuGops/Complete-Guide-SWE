import java.util.*;

class Solution {
    public String shortestCover(String log, String need) {
        if (need.length() > log.length()) {
            return "";
        }

        int[] quota = new int[26];
        int distinct = 0;
        for (int i = 0; i < need.length(); i++) {
            int letter = need.charAt(i) - 'a';
            if (quota[letter] == 0) {
                distinct++;
            }
            quota[letter]++;
        }

        int[] have = new int[26];
        int shortOf = distinct;
        int bestStart = 0;
        int bestLength = -1;
        int left = 0;

        for (int right = 0; right < log.length(); right++) {
            int letter = log.charAt(right) - 'a';
            if (quota[letter] > 0) {
                have[letter]++;
                if (have[letter] == quota[letter]) {
                    shortOf--;
                }
            }

            while (shortOf == 0) {
                if (bestLength == -1 || right - left + 1 < bestLength) {
                    bestLength = right - left + 1;
                    bestStart = left;
                }
                int dropped = log.charAt(left) - 'a';
                if (quota[dropped] > 0) {
                    if (have[dropped] == quota[dropped]) {
                        shortOf++;
                    }
                    have[dropped]--;
                }
                left++;
            }
        }

        if (bestLength == -1) {
            return "";
        }
        return log.substring(bestStart, bestStart + bestLength);
    }
}
