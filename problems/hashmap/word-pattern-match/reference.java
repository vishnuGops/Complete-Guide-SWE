import java.util.*;

class Solution {
    public boolean sameShape(String shape, String sentence) {
        String[] words = sentence.split(" ", -1);
        if (words.length != shape.length()) {
            return false;
        }

        Map<Character, String> wordOfLetter = new HashMap<>();
        Map<String, Character> letterOfWord = new HashMap<>();

        for (int i = 0; i < words.length; i++) {
            char letter = shape.charAt(i);
            String word = words[i];
            String bound = wordOfLetter.get(letter);
            Character claimed = letterOfWord.get(word);

            if (bound == null && claimed == null) {
                wordOfLetter.put(letter, word);
                letterOfWord.put(word, letter);
            } else if (bound == null || claimed == null
                    || !bound.equals(word) || claimed != letter) {
                return false;
            }
        }

        return true;
    }
}
