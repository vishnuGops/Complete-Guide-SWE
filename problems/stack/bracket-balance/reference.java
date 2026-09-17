import java.util.*;

class Solution {

    public boolean isBalanced(String text) {
        Deque<Character> open = new ArrayDeque<>();
        for (int i = 0; i < text.length(); i++) {
            char symbol = text.charAt(i);
            char wanted;
            if (symbol == ')') {
                wanted = '(';
            } else if (symbol == ']') {
                wanted = '[';
            } else if (symbol == '}') {
                wanted = '{';
            } else {
                open.push(symbol);
                continue;
            }
            if (open.isEmpty() || open.pop() != wanted) {
                return false;
            }
        }
        return open.isEmpty();
    }
}
