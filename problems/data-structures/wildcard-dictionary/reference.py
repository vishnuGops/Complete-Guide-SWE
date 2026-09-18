from typing import Dict


class _Node:
    __slots__ = ("children", "ends")

    def __init__(self) -> None:
        self.children: Dict[str, "_Node"] = {}
        self.ends = False


class BlankDictionary:
    def __init__(self) -> None:
        self._root = _Node()

    def add(self, word: str) -> None:
        node = self._root
        for letter in word:
            if letter not in node.children:
                node.children[letter] = _Node()
            node = node.children[letter]
        node.ends = True

    def matches(self, pattern: str) -> bool:
        return self._search(self._root, pattern, 0)

    def _search(self, node: _Node, pattern: str, at: int) -> bool:
        if at == len(pattern):
            return node.ends

        letter = pattern[at]
        if letter != ".":
            child = node.children.get(letter)
            return child is not None and self._search(child, pattern, at + 1)

        # A blank: every child that exists is worth trying.
        for child in node.children.values():
            if self._search(child, pattern, at + 1):
                return True
        return False
