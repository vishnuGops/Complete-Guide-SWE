import java.util.*;

class Solution {
    public int evaluatePostfix(String[] tokens) {
        Deque<Integer> stack = new ArrayDeque<>();

        for (String token : tokens) {
            switch (token) {
                case "+": {
                    int right = stack.pop();
                    stack.push(stack.pop() + right);
                    break;
                }
                case "-": {
                    int right = stack.pop();
                    stack.push(stack.pop() - right);
                    break;
                }
                case "*": {
                    int right = stack.pop();
                    stack.push(stack.pop() * right);
                    break;
                }
                case "/": {
                    int right = stack.pop();
                    // Java's int division already truncates towards zero.
                    stack.push(stack.pop() / right);
                    break;
                }
                default:
                    stack.push(Integer.parseInt(token));
            }
        }

        return stack.pop();
    }
}
