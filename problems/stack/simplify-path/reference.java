import java.util.*;

class Solution {
    public String tidyPath(String path) {
        List<String> names = new ArrayList<>();

        for (String piece : path.split("/", -1)) {
            if (piece.isEmpty() || piece.equals(".")) {
                continue;
            }
            if (piece.equals("..")) {
                if (!names.isEmpty()) {
                    names.remove(names.size() - 1);
                }
            } else {
                names.add(piece);
            }
        }

        return "/" + String.join("/", names);
    }
}
