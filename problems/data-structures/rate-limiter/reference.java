import java.util.*;

class RateLimiter {

    private final int limit;
    private final int window;
    // The times of the allowed requests still inside the window.
    private final Deque<Integer> allowed = new ArrayDeque<>();

    RateLimiter(int limit, int window) {
        this.limit = limit;
        this.window = window;
    }

    public boolean allow(int at) {
        // Anything at or before `at - window` is outside it.
        while (!allowed.isEmpty() && allowed.peekFirst() <= at - window) {
            allowed.removeFirst();
        }

        if (allowed.size() < limit) {
            allowed.addLast(at);
            return true;
        }
        // A refused request is not recorded.
        return false;
    }
}
