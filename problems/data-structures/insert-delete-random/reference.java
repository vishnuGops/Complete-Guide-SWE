import java.util.*;

class RandomSet {

    private final List<Integer> values = new ArrayList<>();
    private final Map<Integer, Integer> where = new HashMap<>();
    private final Random rng = new Random(7);

    RandomSet() {
    }

    public boolean add(int value) {
        if (where.containsKey(value)) {
            return false;
        }
        where.put(value, values.size());
        values.add(value);
        return true;
    }

    public boolean remove(int value) {
        Integer hole = where.get(value);
        if (hole == null) {
            return false;
        }
        int last = values.get(values.size() - 1);
        // Fill the hole with the last element and tell the map where it went.
        values.set(hole, last);
        where.put(last, hole);
        values.remove(values.size() - 1);
        where.remove(value);
        return true;
    }

    public int pick() {
        return values.get(rng.nextInt(values.size()));
    }
}
