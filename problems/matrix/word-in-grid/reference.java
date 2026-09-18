import java.util.*;

class Solution {

    private char[] letters;

    public boolean findWord(char[][] board, String word) {
        int rows = board.length;
        int columns = board[0].length;

        if (word.length() > rows * columns) {
            return false;
        }

        // The board must hold at least as many of each letter as the word needs.
        int[] counts = new int[26];
        for (char[] row : board) {
            for (char letter : row) {
                counts[letter - 'a']++;
            }
        }
        int[] needed = new int[26];
        for (int i = 0; i < word.length(); i++) {
            needed[word.charAt(i) - 'a']++;
        }
        for (int letter = 0; letter < 26; letter++) {
            if (counts[letter] < needed[letter]) {
                return false;
            }
        }

        // Start from the rarer end: the same path, walked backwards.
        letters = word.toCharArray();
        if (counts[letters[0] - 'a'] > counts[letters[letters.length - 1] - 'a']) {
            for (int left = 0, right = letters.length - 1; left < right; left++, right--) {
                char carried = letters[left];
                letters[left] = letters[right];
                letters[right] = carried;
            }
        }

        for (int row = 0; row < rows; row++) {
            for (int column = 0; column < columns; column++) {
                if (search(board, row, column, 0)) {
                    return true;
                }
            }
        }
        return false;
    }

    private boolean search(char[][] board, int row, int column, int at) {
        if (at == letters.length) {
            return true;
        }
        if (row < 0 || row >= board.length || column < 0 || column >= board[0].length) {
            return false;
        }
        if (board[row][column] != letters[at]) {
            return false;
        }

        char saved = board[row][column];
        board[row][column] = '#';
        boolean found = search(board, row + 1, column, at + 1)
                || search(board, row - 1, column, at + 1)
                || search(board, row, column + 1, at + 1)
                || search(board, row, column - 1, at + 1);
        board[row][column] = saved;
        return found;
    }
}
