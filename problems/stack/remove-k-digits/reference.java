import java.util.*;

class Solution {
    public String smallestAfterRemoving(String digits, int k) {
        StringBuilder kept = new StringBuilder();
        int remaining = k;

        for (int i = 0; i < digits.length(); i++) {
            char digit = digits.charAt(i);
            while (remaining > 0 && kept.length() > 0 && kept.charAt(kept.length() - 1) > digit) {
                kept.deleteCharAt(kept.length() - 1);
                remaining--;
            }
            kept.append(digit);
        }

        // What is left is non-decreasing, so any unused removals come off the
        // back, where the largest digits are.
        kept.setLength(kept.length() - remaining);

        int at = 0;
        while (at < kept.length() - 1 && kept.charAt(at) == '0') {
            at++;
        }
        String answer = kept.substring(at);
        return answer.isEmpty() ? "0" : answer;
    }
}
