import java.util.*;

class Solution {

    private String letters;
    private Set<String> words;
    // Position -> every reading of the letters from there onwards.
    private Map<Integer, List<String>> memo;

    public String[] everyReading(String letters, String[] dictionary) {
        this.letters = letters;
        this.words = new HashSet<>(Arrays.asList(dictionary));
        this.memo = new HashMap<>();
        return readings(0).toArray(new String[0]);
    }

    private List<String> readings(int at) {
        if (at == letters.length()) {
            // One way to read nothing, not zero ways.
            return List.of("");
        }
        List<String> remembered = memo.get(at);
        if (remembered != null) {
            return remembered;
        }

        List<String> out = new ArrayList<>();
        for (int end = at + 1; end <= letters.length(); end++) {
            String word = letters.substring(at, end);
            if (!words.contains(word)) {
                continue;
            }
            for (String rest : readings(end)) {
                out.add(rest.isEmpty() ? word : word + " " + rest);
            }
        }

        memo.put(at, out);
        return out;
    }
}
