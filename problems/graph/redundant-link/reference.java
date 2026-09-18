import java.util.*;

class Solution {

    private int[] parent;
    private int[] size;

    public int[] closingLink(int n, int[][] links) {
        parent = new int[n];
        size = new int[n];
        for (int i = 0; i < n; i++) {
            parent[i] = i;
            size[i] = 1;
        }

        for (int[] link : links) {
            int rootA = find(link[0]);
            int rootB = find(link[1]);
            if (rootA == rootB) {
                return new int[] {link[0], link[1]};
            }
            // Union by size, so the trees stay shallow.
            if (size[rootA] < size[rootB]) {
                int carried = rootA;
                rootA = rootB;
                rootB = carried;
            }
            parent[rootB] = rootA;
            size[rootA] += size[rootB];
        }

        return new int[0];
    }

    /** Path compression, written as a loop so a long chain costs no stack. */
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
