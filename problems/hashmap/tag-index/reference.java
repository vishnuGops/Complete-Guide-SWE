import java.util.*;

class TagIndex {

    private final Map<String, String> tagOfItem = new HashMap<>();
    private final Map<String, Integer> itemsPerTag = new HashMap<>();

    TagIndex() {
    }

    public void add(String item, String tag) {
        detach(item);
        tagOfItem.put(item, tag);
        itemsPerTag.merge(tag, 1, Integer::sum);
    }

    public void remove(String item) {
        detach(item);
        tagOfItem.remove(item);
    }

    public int count(String tag) {
        return itemsPerTag.getOrDefault(tag, 0);
    }

    public String tagOf(String item) {
        return tagOfItem.getOrDefault(item, "");
    }

    private void detach(String item) {
        String current = tagOfItem.get(item);
        if (current == null) {
            return;
        }
        int remaining = itemsPerTag.get(current) - 1;
        if (remaining == 0) {
            itemsPerTag.remove(current);
        } else {
            itemsPerTag.put(current, remaining);
        }
    }
}
