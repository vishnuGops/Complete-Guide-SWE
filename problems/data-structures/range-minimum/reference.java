import java.util.*;

class MinTable {

    private final int n;
    private final int[] tree;

    MinTable(int[] readings) {
        n = readings.length;
        // Leaves at n .. 2n-1; the parent of i is i / 2.
        tree = new int[2 * n];
        System.arraycopy(readings, 0, tree, n, n);
        for (int index = n - 1; index >= 1; index--) {
            tree[index] = Math.min(tree[2 * index], tree[2 * index + 1]);
        }
    }

    public void set(int at, int value) {
        int index = at + n;
        tree[index] = value;
        // Only the path to the root is affected, and all of it is.
        for (index /= 2; index >= 1; index /= 2) {
            tree[index] = Math.min(tree[2 * index], tree[2 * index + 1]);
        }
    }

    public int smallest(int start, int end) {
        int best = Integer.MAX_VALUE;
        int left = start + n;
        int right = end + n + 1;      // half-open

        while (left < right) {
            if ((left & 1) != 0) {
                // A right-hand child: take it, it cannot be absorbed upwards.
                best = Math.min(best, tree[left]);
                left++;
            }
            if ((right & 1) != 0) {
                right--;
                best = Math.min(best, tree[right]);
            }
            left /= 2;
            right /= 2;
        }

        return best;
    }
}
