import java.util.*;

class Solution {
    public String expand(String shorthand) {
        Deque<Integer> counts = new ArrayDeque<>();
        Deque<StringBuilder> texts = new ArrayDeque<>();
        StringBuilder current = new StringBuilder();
        int count = 0;

        for (int i = 0; i < shorthand.length(); i++) {
            char character = shorthand.charAt(i);
            if (character >= '0' && character <= '9') {
                count = count * 10 + (character - '0');
            } else if (character == '[') {
                counts.push(count);
                count = 0;
                texts.push(current);
                current = new StringBuilder();
            } else if (character == ']') {
                StringBuilder prefix = texts.pop();
                int times = counts.pop();
                for (int repeat = 0; repeat < times; repeat++) {
                    prefix.append(current);
                }
                current = prefix;
            } else {
                current.append(character);
            }
        }

        return current.toString();
    }
}
