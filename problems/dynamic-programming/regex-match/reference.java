import java.util.*;

class Solution {
    public boolean matches(String text, String pattern) {
        int n = text.length();
        int m = pattern.length();

        // ok[i][j]: the first i letters matched by the first j pattern parts.
        boolean[][] ok = new boolean[n + 1][m + 1];
        ok[0][0] = true;

        // The empty text: only groups that can match nothing.
        for (int j = 2; j <= m; j++) {
            if (pattern.charAt(j - 1) == '*') {
                ok[0][j] = ok[0][j - 2];
            }
        }

        for (int i = 1; i <= n; i++) {
            for (int j = 1; j <= m; j++) {
                char part = pattern.charAt(j - 1);
                if (part == '*') {
                    char before = pattern.charAt(j - 2);
                    // Zero occurrences, or one more of the same thing.
                    ok[i][j] = ok[i][j - 2]
                            || (ok[i - 1][j]
                                && (before == '.' || before == text.charAt(i - 1)));
                } else {
                    ok[i][j] = ok[i - 1][j - 1]
                            && (part == '.' || part == text.charAt(i - 1));
                }
            }
        }

        return ok[n][m];
    }
}
