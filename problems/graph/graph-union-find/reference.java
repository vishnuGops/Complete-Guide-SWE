import java.util.*;

class Connections {

    private final int[] parent;
    private final int[] size;
    private int groups;

    Connections(int n) {
        parent = new int[n];
        size = new int[n];
        for (int i = 0; i < n; i++) {
            parent[i] = i;
            size[i] = 1;
        }
        groups = n;
    }

    public boolean link(int a, int b) {
        int rootA = find(a);
        int rootB = find(b);
        if (rootA == rootB) {
            return false;
        }
        // Union by size, so the trees stay shallow.
        if (size[rootA] < size[rootB]) {
            int carried = rootA;
            rootA = rootB;
            rootB = carried;
        }
        parent[rootB] = rootA;
        size[rootA] += size[rootB];
        groups--;
        return true;
    }

    public boolean joined(int a, int b) {
        return find(a) == find(b);
    }

    public int groups() {
        return groups;
    }

    public int sizeOf(int a) {
        return size[find(a)];
    }

    /** Path compression, as a loop: the chain can be long before it is flat. */
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
