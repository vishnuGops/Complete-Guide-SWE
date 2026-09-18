import java.util.*;

class Solution {
    public int sharedLength(String first, String second) {
        // Keep the shorter word along the row, so the row is as short as it can be.
        if (second.length() > first.length()) {
            String carried = first;
            first = second;
            second = carried;
        }

        int[] previous = new int[second.length() + 1];
        int[] current = new int[second.length() + 1];

        for (int i = 1; i <= first.length(); i++) {
            for (int j = 1; j <= second.length(); j++) {
                if (first.charAt(i - 1) == second.charAt(j - 1)) {
                    // Equal last letters: some longest reading uses them both.
                    current[j] = previous[j - 1] + 1;
                } else {
                    current[j] = Math.max(previous[j], current[j - 1]);
                }
            }
            int[] carried = previous;
            previous = current;
            current = carried;
        }

        return previous[second.length()];
    }
}
