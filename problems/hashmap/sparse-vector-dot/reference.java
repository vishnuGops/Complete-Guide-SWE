import java.util.*;

class SparseReadings {

    /** name -> the non-zero entries, as parallel arrays sorted by position. */
    private final Map<String, int[][]> rows = new HashMap<>();

    SparseReadings() {
    }

    public void add(String name, int[] values) {
        int kept = 0;
        for (int value : values) {
            if (value != 0) {
                kept++;
            }
        }

        int[] positions = new int[kept];
        int[] readings = new int[kept];
        int at = 0;
        for (int position = 0; position < values.length; position++) {
            if (values[position] != 0) {
                positions[at] = position;
                readings[at] = values[position];
                at++;
            }
        }
        rows.put(name, new int[][] {positions, readings});
    }

    public int dot(String first, String second) {
        int[][] left = rows.get(first);
        int[][] right = rows.get(second);
        if (left == null || right == null) {
            return 0;
        }

        int total = 0;
        int i = 0;
        int j = 0;
        while (i < left[0].length && j < right[0].length) {
            if (left[0][i] == right[0][j]) {
                total += left[1][i] * right[1][j];
                i++;
                j++;
            } else if (left[0][i] < right[0][j]) {
                i++;
            } else {
                j++;
            }
        }
        return total;
    }

    public int nonZeroCount(String name) {
        int[][] row = rows.get(name);
        return row == null ? 0 : row[0].length;
    }
}
