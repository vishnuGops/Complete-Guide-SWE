import java.util.*;

class BrowserHistory {

    private final List<String> pages = new ArrayList<>();
    private int at;

    BrowserHistory(String homepage) {
        pages.add(homepage);
        at = 0;
    }

    public void visit(String url) {
        // Everything ahead of the current page is discarded.
        while (pages.size() > at + 1) {
            pages.remove(pages.size() - 1);
        }
        pages.add(url);
        at++;
    }

    public String back(int steps) {
        at = Math.max(0, at - steps);
        return pages.get(at);
    }

    public String forward(int steps) {
        at = Math.min(pages.size() - 1, at + steps);
        return pages.get(at);
    }
}
