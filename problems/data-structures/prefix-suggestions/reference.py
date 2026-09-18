from typing import Dict, List, Optional


class _Node:
    __slots__ = ("children", "ends")

    def __init__(self) -> None:
        self.children: Dict[str, "_Node"] = {}
        self.ends = False


class Suggester:
    def __init__(self) -> None:
        self._root = _Node()

    def add(self, word: str) -> None:
        node = self._root
        for letter in word:
            if letter not in node.children:
                node.children[letter] = _Node()
            node = node.children[letter]
        node.ends = True

    def suggest(self, prefix: str) -> List[str]:
        node = self._root
        for letter in prefix:
            child = node.children.get(letter)
            if child is None:
                return []
            node = child

        out: List[str] = []
        self._collect(node, prefix, out)
        return out

    def _collect(self, node: _Node, sofar: str, out: List[str]) -> None:
        if len(out) == 3:
            return
        if node.ends:
            out.append(sofar)
        # Alphabetical order, so the answer comes out sorted.
        for letter in sorted(node.children):
            self._collect(node.children[letter], sofar + letter, out)
            if len(out) == 3:
                return
