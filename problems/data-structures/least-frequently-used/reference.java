import java.util.*;

class PopularCache {

    private final int capacity;
    private final Map<Integer, Integer> value = new HashMap<>();
    private final Map<Integer, Integer> uses = new HashMap<>();
    // count -> the keys with that count, least recently used first.
    private final Map<Integer, LinkedHashSet<Integer>> group = new HashMap<>();
    private int smallest;

    PopularCache(int capacity) {
        this.capacity = capacity;
    }

    public int get(int key) {
        if (!value.containsKey(key)) {
            return -1;
        }
        promote(key);
        return value.get(key);
    }

    public void put(int key, int newValue) {
        if (capacity == 0) {
            return;
        }

        if (value.containsKey(key)) {
            value.put(key, newValue);
            promote(key);
            return;
        }

        if (value.size() == capacity) {
            // Least used, and among those the one used longest ago.
            LinkedHashSet<Integer> weakest = group.get(smallest);
            int oldest = weakest.iterator().next();
            weakest.remove(oldest);
            value.remove(oldest);
            uses.remove(oldest);
        }

        value.put(key, newValue);
        uses.put(key, 1);
        group.computeIfAbsent(1, k -> new LinkedHashSet<>()).add(key);
        // A new key has one use, and nothing can have fewer.
        smallest = 1;
    }

    private void promote(int key) {
        int count = uses.get(key);
        LinkedHashSet<Integer> from = group.get(count);
        from.remove(key);
        if (from.isEmpty() && smallest == count) {
            // The smallest group only ever rises by one.
            smallest = count + 1;
        }
        uses.put(key, count + 1);
        group.computeIfAbsent(count + 1, k -> new LinkedHashSet<>()).add(key);
    }
}
