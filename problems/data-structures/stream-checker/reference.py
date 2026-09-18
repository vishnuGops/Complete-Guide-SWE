from typing import Dict, List


class _Node:
    __slots__ = ("children", "ends")

    def __init__(self) -> None:
        self.children: Dict[str, "_Node"] = {}
        self.ends = False


class StreamChecker:
    def __init__(self, words: List[str]) -> None:
        self._root = _Node()
        self._longest = 0
        for word in words:
            self._longest = max(self._longest, len(word))
            node = self._root
            # Stored backwards: a suffix read backwards is a prefix.
            for letter in reversed(word):
                if letter not in node.children:
                    node.children[letter] = _Node()
                node = node.children[letter]
            node.ends = True

        self._stream: List[str] = []

    def next(self, letter: str) -> bool:
        self._stream.append(letter)
        # Nothing older than the longest word can be part of a match.
        if len(self._stream) > self._longest:
            del self._stream[0]

        node = self._root
        for at in range(len(self._stream) - 1, -1, -1):
            child = node.children.get(self._stream[at])
            if child is None:
                return False
            if child.ends:
                return True
            node = child

        return False
