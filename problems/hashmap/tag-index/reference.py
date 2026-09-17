from typing import Dict


class TagIndex:
    def __init__(self) -> None:
        self._tag_of_item: Dict[str, str] = {}
        self._items_per_tag: Dict[str, int] = {}

    def add(self, item: str, tag: str) -> None:
        self._detach(item)
        self._tag_of_item[item] = tag
        self._items_per_tag[tag] = self._items_per_tag.get(tag, 0) + 1

    def remove(self, item: str) -> None:
        self._detach(item)
        self._tag_of_item.pop(item, None)

    def count(self, tag: str) -> int:
        return self._items_per_tag.get(tag, 0)

    def tagOf(self, item: str) -> str:
        return self._tag_of_item.get(item, "")

    def _detach(self, item: str) -> None:
        current = self._tag_of_item.get(item)
        if current is None:
            return
        remaining = self._items_per_tag[current] - 1
        if remaining == 0:
            del self._items_per_tag[current]
        else:
            self._items_per_tag[current] = remaining
