import java.util.*;

class Solution {

    private static final String[] LETTERS = {
        "", "", "abc", "def", "ghi", "jkl", "mno", "pqrs", "tuv", "wxyz"
    };

    private String digits;
    private final List<String> out = new ArrayList<>();
    private final StringBuilder sofar = new StringBuilder();

    public String[] keypadWords(String digits) {
        // No digits means no strings, not one empty string.
        if (digits.isEmpty()) {
            return new String[0];
        }
        this.digits = digits;
        build(0);
        return out.toArray(new String[0]);
    }

    private void build(int at) {
        if (at == digits.length()) {
            out.add(sofar.toString());
            return;
        }
        String letters = LETTERS[digits.charAt(at) - '0'];
        for (int i = 0; i < letters.length(); i++) {
            sofar.append(letters.charAt(i));
            build(at + 1);
            sofar.deleteCharAt(sofar.length() - 1);
        }
    }
}
