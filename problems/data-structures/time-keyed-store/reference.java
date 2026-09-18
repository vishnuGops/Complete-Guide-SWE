import java.util.*;

class TimeStore {

    // key -> (times, values), both appended in increasing time order.
    private final Map<String, List<Integer>> times = new HashMap<>();
    private final Map<String, List<String>> values = new HashMap<>();

    TimeStore() {
    }

    public void set(String key, String value, int at) {
        // The times increase, so appending keeps the list sorted.
        times.computeIfAbsent(key, k -> new ArrayList<>()).add(at);
        values.computeIfAbsent(key, k -> new ArrayList<>()).add(value);
    }

    public String get(String key, int at) {
        List<Integer> stamps = times.get(key);
        if (stamps == null) {
            return "";
        }
        // The first entry after `at`; the answer is the one before it.
        int low = 0;
        int high = stamps.size();
        while (low < high) {
            int mid = low + (high - low) / 2;
            if (stamps.get(mid) <= at) {
                low = mid + 1;
            } else {
                high = mid;
            }
        }
        return low == 0 ? "" : values.get(key).get(low - 1);
    }
}
