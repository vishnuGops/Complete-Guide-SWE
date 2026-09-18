import java.util.*;

class Solution {
    public String largestJoined(int[] parts) {
        String[] written = new String[parts.length];
        for (int i = 0; i < parts.length; i++) {
            written[i] = Integer.toString(parts[i]);
        }

        // Whichever joining is larger as text decides which part goes first.
        Arrays.sort(written, (left, right) -> (right + left).compareTo(left + right));

        StringBuilder joined = new StringBuilder();
        for (String part : written) {
            joined.append(part);
        }

        // All zeroes would otherwise print as "000".
        return joined.charAt(0) == '0' ? "0" : joined.toString();
    }
}
