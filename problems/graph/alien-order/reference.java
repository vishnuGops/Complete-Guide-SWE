import java.util.*;

class Solution {
    public String alphabetOrder(String[] words) {
        boolean[] present = new boolean[26];
        for (String word : words) {
            for (int i = 0; i < word.length(); i++) {
                present[word.charAt(i) - 'a'] = true;
            }
        }
        int distinct = 0;
        for (boolean seen : present) {
            if (seen) {
                distinct++;
            }
        }

        boolean[][] before = new boolean[26][26];
        int[] waiting = new int[26];

        for (int index = 0; index + 1 < words.length; index++) {
            String first = words[index];
            String second = words[index + 1];
            int shared = Math.min(first.length(), second.length());
            int at = 0;
            while (at < shared && first.charAt(at) == second.charAt(at)) {
                at++;
            }
            if (at == shared) {
                // Identical as far as the shorter word goes: a longer word
                // before its own prefix is impossible in any alphabet.
                if (first.length() > second.length()) {
                    return "";
                }
                continue;
            }
            int a = first.charAt(at) - 'a';
            int b = second.charAt(at) - 'a';
            if (!before[a][b]) {
                before[a][b] = true;
                waiting[b]++;
            }
        }

        // A heap, not a queue: the answer must be the smallest valid order.
        PriorityQueue<Integer> available = new PriorityQueue<>();
        for (int letter = 0; letter < 26; letter++) {
            if (present[letter] && waiting[letter] == 0) {
                available.offer(letter);
            }
        }

        StringBuilder order = new StringBuilder();
        while (!available.isEmpty()) {
            int letter = available.poll();
            order.append((char) ('a' + letter));
            for (int later = 0; later < 26; later++) {
                if (before[letter][later] && --waiting[later] == 0) {
                    available.offer(later);
                }
            }
        }

        return order.length() == distinct ? order.toString() : "";
    }
}
