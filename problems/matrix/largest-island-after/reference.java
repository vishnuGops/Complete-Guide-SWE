import java.util.*;

class Solution {
    public int largestAfterFilling(int[][] terrain) {
        int rows = terrain.length;
        int columns = terrain[0].length;
        int[] rowStep = {-1, 1, 0, 0};
        int[] columnStep = {0, 0, -1, 1};

        // Label each island in place; 0 and 1 are taken, so labels start at 2.
        Map<Integer, Integer> sizes = new HashMap<>();
        int label = 2;
        for (int startRow = 0; startRow < rows; startRow++) {
            for (int startColumn = 0; startColumn < columns; startColumn++) {
                if (terrain[startRow][startColumn] != 1) {
                    continue;
                }
                Deque<int[]> stack = new ArrayDeque<>();
                stack.push(new int[] {startRow, startColumn});
                terrain[startRow][startColumn] = label;
                int size = 0;
                while (!stack.isEmpty()) {
                    int[] at = stack.pop();
                    size++;
                    for (int step = 0; step < 4; step++) {
                        int nextRow = at[0] + rowStep[step];
                        int nextColumn = at[1] + columnStep[step];
                        if (nextRow >= 0 && nextRow < rows && nextColumn >= 0 && nextColumn < columns
                                && terrain[nextRow][nextColumn] == 1) {
                            terrain[nextRow][nextColumn] = label;
                            stack.push(new int[] {nextRow, nextColumn});
                        }
                    }
                }
                sizes.put(label, size);
                label++;
            }
        }

        int best = 0;
        for (int size : sizes.values()) {
            best = Math.max(best, size);
        }

        Set<Integer> touching = new HashSet<>();
        for (int row = 0; row < rows; row++) {
            for (int column = 0; column < columns; column++) {
                if (terrain[row][column] != 0) {
                    continue;
                }
                // Distinct labels only: one island can touch this cell twice.
                touching.clear();
                for (int step = 0; step < 4; step++) {
                    int nextRow = row + rowStep[step];
                    int nextColumn = column + columnStep[step];
                    if (nextRow >= 0 && nextRow < rows && nextColumn >= 0 && nextColumn < columns
                            && terrain[nextRow][nextColumn] >= 2) {
                        touching.add(terrain[nextRow][nextColumn]);
                    }
                }
                int total = 1;
                for (int found : touching) {
                    total += sizes.get(found);
                }
                best = Math.max(best, total);
            }
        }

        return best;
    }
}
