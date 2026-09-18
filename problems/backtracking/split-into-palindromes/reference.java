import java.util.*;

class Solution {

    private String word;
    private final List<String[]> out = new ArrayList<>();
    private final List<String> pieces = new ArrayList<>();

    public String[][] palindromeCuts(String word) {
        this.word = word;
        build(0);
        return out.toArray(new String[0][]);
    }

    private boolean readsSame(int start, int end) {
        int left = start;
        int right = end - 1;
        while (left < right) {
            if (word.charAt(left) != word.charAt(right)) {
                return false;
            }
            left++;
            right--;
        }
        return true;
    }

    private void build(int at) {
        if (at == word.length()) {
            out.add(pieces.toArray(new String[0]));
            return;
        }
        for (int end = at + 1; end <= word.length(); end++) {
            // Checked before recursing: an invalid prefix kills the branch.
            if (readsSame(at, end)) {
                pieces.add(word.substring(at, end));
                build(end);
                pieces.remove(pieces.size() - 1);
            }
        }
    }
}
