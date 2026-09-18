import java.util.*;

class Solution {
    public int ladderLength(String start, String target, String[] words) {
        Set<String> allowed = new HashSet<>(Arrays.asList(words));
        if (!allowed.contains(target)) {
            return 0;
        }
        if (start.equals(target)) {
            return 1;
        }

        // Blanked form -> the words matching it. Two words differ in exactly
        // one position exactly when they share one of these.
        Map<String, List<String>> buckets = new HashMap<>();
        for (String word : words) {
            char[] letters = word.toCharArray();
            for (int at = 0; at < letters.length; at++) {
                char saved = letters[at];
                letters[at] = '*';
                buckets.computeIfAbsent(new String(letters), key -> new ArrayList<>()).add(word);
                letters[at] = saved;
            }
        }

        Set<String> seen = new HashSet<>();
        seen.add(start);
        Deque<Object[]> queue = new ArrayDeque<>();
        queue.addLast(new Object[] {start, 1});

        while (!queue.isEmpty()) {
            Object[] entry = queue.removeFirst();
            String word = (String) entry[0];
            int rungs = (Integer) entry[1];

            char[] letters = word.toCharArray();
            for (int at = 0; at < letters.length; at++) {
                char saved = letters[at];
                letters[at] = '*';
                String form = new String(letters);
                letters[at] = saved;

                List<String> matching = buckets.get(form);
                if (matching == null) {
                    continue;
                }
                for (String other : matching) {
                    if (other.equals(target)) {
                        return rungs + 1;
                    }
                    if (seen.add(other)) {
                        // Added when queued, so a word is walked once.
                        queue.addLast(new Object[] {other, rungs + 1});
                    }
                }
                matching.clear();
            }
        }

        return 0;
    }
}
