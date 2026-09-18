from typing import Dict


class Solution:
    def sameShape(self, shape: str, sentence: str) -> bool:
        words = sentence.split(" ")
        if len(words) != len(shape):
            return False

        word_of_letter: Dict[str, str] = {}
        letter_of_word: Dict[str, str] = {}

        for letter, word in zip(shape, words):
            bound = word_of_letter.get(letter)
            claimed = letter_of_word.get(word)
            if bound is None and claimed is None:
                word_of_letter[letter] = word
                letter_of_word[word] = letter
            elif bound != word or claimed != letter:
                return False

        return True
