import java.util.*;

class Solution {

    private int[] parent;
    private int[] size;

    public int connectAll(int n, int[][] cables) {
        parent = new int[n];
        size = new int[n];
        for (int i = 0; i < n; i++) {
            parent[i] = i;
            size[i] = 1;
        }

        int[][] sorted = cables.clone();
        Arrays.sort(sorted, (left, right) -> Integer.compare(left[2], right[2]));

        int bought = 0;
        int total = 0;

        for (int[] cable : sorted) {
            int rootA = find(cable[0]);
            int rootB = find(cable[1]);
            if (rootA == rootB) {
                // Both ends are already connected: this cable closes a loop.
                continue;
            }
            if (size[rootA] < size[rootB]) {
                int carried = rootA;
                rootA = rootB;
                rootB = carried;
            }
            parent[rootB] = rootA;
            size[rootA] += size[rootB];
            total += cable[2];
            bought++;
            if (bought == n - 1) {
                return total;
            }
        }

        return n == 1 ? total : -1;
    }

    private int find(int x) {
        int root = x;
        while (parent[root] != root) {
            root = parent[root];
        }
        while (parent[x] != root) {
            int next = parent[x];
            parent[x] = root;
            x = next;
        }
        return root;
    }
}
