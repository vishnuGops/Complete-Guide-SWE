import java.util.*;

class Solution {

    private int[] parent;

    public String[][] mergeAccounts(String[][] accounts) {
        parent = new int[accounts.length];
        for (int i = 0; i < accounts.length; i++) {
            parent[i] = i;
        }

        // address -> the first account that mentioned it.
        Map<String, Integer> owner = new HashMap<>();
        for (int index = 0; index < accounts.length; index++) {
            for (int at = 1; at < accounts[index].length; at++) {
                String address = accounts[index][at];
                Integer first = owner.get(address);
                if (first == null) {
                    owner.put(address, index);
                } else {
                    int a = find(index);
                    int b = find(first);
                    if (a != b) {
                        parent[b] = a;
                    }
                }
            }
        }

        Map<Integer, TreeSet<String>> grouped = new HashMap<>();
        for (int index = 0; index < accounts.length; index++) {
            int root = find(index);
            TreeSet<String> addresses =
                    grouped.computeIfAbsent(root, key -> new TreeSet<>());
            for (int at = 1; at < accounts[index].length; at++) {
                addresses.add(accounts[index][at]);
            }
        }

        List<String[]> out = new ArrayList<>();
        for (Map.Entry<Integer, TreeSet<String>> entry : grouped.entrySet()) {
            List<String> one = new ArrayList<>();
            one.add(accounts[entry.getKey()][0]);
            one.addAll(entry.getValue());
            out.add(one.toArray(new String[0]));
        }

        // Sorted, because a map's order differs between languages.
        out.sort((left, right) -> left[0].equals(right[0])
                ? left[1].compareTo(right[1])
                : left[0].compareTo(right[0]));
        return out.toArray(new String[0][]);
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
