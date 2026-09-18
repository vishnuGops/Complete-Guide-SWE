from typing import Dict, Optional


class _Node:
    __slots__ = ("key", "value", "before", "after")

    def __init__(self, key: int, value: int) -> None:
        self.key = key
        self.value = value
        self.before: Optional["_Node"] = None
        self.after: Optional["_Node"] = None


class RecentCache:
    def __init__(self, capacity: int) -> None:
        self._capacity = capacity
        self._by_key: Dict[int, _Node] = {}
        # Dummy ends, so unlinking and inserting need no null checks.
        self._head = _Node(0, 0)
        self._tail = _Node(0, 0)
        self._head.after = self._tail
        self._tail.before = self._head

    def get(self, key: int) -> int:
        node = self._by_key.get(key)
        if node is None:
            return -1
        self._unlink(node)
        self._push_front(node)
        return node.value

    def put(self, key: int, value: int) -> None:
        node = self._by_key.get(key)
        if node is not None:
            node.value = value
            self._unlink(node)
            self._push_front(node)
            return

        if len(self._by_key) == self._capacity:
            oldest = self._tail.before
            self._unlink(oldest)
            # The node carries its key, because the map entry has to go too.
            del self._by_key[oldest.key]

        fresh = _Node(key, value)
        self._by_key[key] = fresh
        self._push_front(fresh)

    def _unlink(self, node: _Node) -> None:
        node.before.after = node.after
        node.after.before = node.before

    def _push_front(self, node: _Node) -> None:
        node.after = self._head.after
        node.before = self._head
        self._head.after.before = node
        self._head.after = node
