import java.util.*;

class Solution {

    private int pairs;
    private int limit;
    private final List<String> out = new ArrayList<>();
    private final StringBuilder sofar = new StringBuilder();

    public String[] balancedFragments(int n, int depth) {
        this.pairs = n;
        this.limit = depth;
        build(0, 0);
        return out.toArray(new String[0]);
    }

    private void build(int opened, int closed) {
        if (opened == pairs && closed == pairs) {
            out.add(sofar.toString());
            return;
        }
        // Room for another pair, and room to nest one deeper.
        if (opened < pairs && opened - closed < limit) {
            sofar.append('(');
            build(opened + 1, closed);
            sofar.deleteCharAt(sofar.length() - 1);
        }
        // Something is open to close.
        if (closed < opened) {
            sofar.append(')');
            build(opened, closed + 1);
            sofar.deleteCharAt(sofar.length() - 1);
        }
    }
}
