import java.util.*;

class Solution {
    public int fewestEdits(String start, String into) {
        // Keep the shorter word along the row.
        if (into.length() > start.length()) {
            String carried = start;
            start = into;
            into = carried;
        }

        int[] previous = new int[into.length() + 1];
        int[] current = new int[into.length() + 1];
        // Row 0: turning nothing into the first j letters costs j insertions.
        for (int j = 0; j <= into.length(); j++) {
            previous[j] = j;
        }

        for (int i = 1; i <= start.length(); i++) {
            // Column 0: turning i letters into nothing costs i deletions.
            current[0] = i;
            for (int j = 1; j <= into.length(); j++) {
                if (start.charAt(i - 1) == into.charAt(j - 1)) {
                    current[j] = previous[j - 1];
                } else {
                    current[j] = 1 + Math.min(previous[j],
                            Math.min(current[j - 1], previous[j - 1]));
                }
            }
            int[] carried = previous;
            previous = current;
            current = carried;
        }

        return previous[into.length()];
    }
}
