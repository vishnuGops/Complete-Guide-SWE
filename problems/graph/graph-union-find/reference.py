from typing import List


class Connections:
    def __init__(self, n: int) -> None:
        self._parent: List[int] = list(range(n))
        self._size: List[int] = [1] * n
        self._groups = n

    def link(self, a: int, b: int) -> bool:
        root_a = self._find(a)
        root_b = self._find(b)
        if root_a == root_b:
            return False
        # Union by size, so the trees stay shallow.
        if self._size[root_a] < self._size[root_b]:
            root_a, root_b = root_b, root_a
        self._parent[root_b] = root_a
        self._size[root_a] += self._size[root_b]
        self._groups -= 1
        return True

    def joined(self, a: int, b: int) -> bool:
        return self._find(a) == self._find(b)

    def groups(self) -> int:
        return self._groups

    def sizeOf(self, a: int) -> int:
        return self._size[self._find(a)]

    def _find(self, x: int) -> int:
        # Path compression, as a loop: the chain can be long before it is flat.
        root = x
        while self._parent[root] != root:
            root = self._parent[root]
        while self._parent[x] != root:
            self._parent[x], x = root, self._parent[x]
        return root
