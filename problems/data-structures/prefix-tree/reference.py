from typing import Dict, Optional


class _Node:
    __slots__ = ("children", "ends")

    def __init__(self) -> None:
        self.children: Dict[str, "_Node"] = {}
        self.ends = False


class PrefixTree:
    def __init__(self) -> None:
        self._root = _Node()

    def add(self, word: str) -> None:
        node = self._root
        for letter in word:
            if letter not in node.children:
                node.children[letter] = _Node()
            node = node.children[letter]
        node.ends = True

    def has(self, word: str) -> bool:
        node = self._walk(word)
        return node is not None and node.ends

    def startsWith(self, prefix: str) -> bool:
        return self._walk(prefix) is not None

    def _walk(self, text: str) -> Optional[_Node]:
        node = self._root
        for letter in text:
            child = node.children.get(letter)
            if child is None:
                return None
            node = child
        return node
