import java.util.*;

class Solution {

    private String digits;
    private final List<String> out = new ArrayList<>();
    private final List<String> parts = new ArrayList<>();

    public String[] restoreAddresses(String digits) {
        this.digits = digits;
        build(0, 0);
        return out.toArray(new String[0]);
    }

    private void build(int at, int placed) {
        int left = digits.length() - at;
        int remaining = 4 - placed;
        // Too few digits to fill the numbers left, or too many to fit.
        if (left < remaining || left > 3 * remaining) {
            return;
        }
        if (placed == 4) {
            if (at == digits.length()) {
                out.add(String.join(".", parts));
            }
            return;
        }
        for (int length = 1; length <= 3; length++) {
            if (at + length > digits.length()) {
                break;
            }
            String piece = digits.substring(at, at + length);
            if (length > 1 && piece.charAt(0) == '0') {
                break;
            }
            if (Integer.parseInt(piece) > 255) {
                break;
            }
            parts.add(piece);
            build(at + length, placed + 1);
            parts.remove(parts.size() - 1);
        }
    }
}
