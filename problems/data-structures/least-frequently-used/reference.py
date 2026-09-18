from collections import OrderedDict
from typing import Dict


class PopularCache:
    def __init__(self, capacity: int) -> None:
        self._capacity = capacity
        self._value: Dict[int, int] = {}
        self._uses: Dict[int, int] = {}
        # count -> the keys with that count, least recently used first.
        self._group: Dict[int, "OrderedDict[int, None]"] = {}
        self._smallest = 0

    def get(self, key: int) -> int:
        if key not in self._value:
            return -1
        self._promote(key)
        return self._value[key]

    def put(self, key: int, value: int) -> None:
        if self._capacity == 0:
            return

        if key in self._value:
            self._value[key] = value
            self._promote(key)
            return

        if len(self._value) == self._capacity:
            # Least used, and among those the one used longest ago.
            oldest, _ = self._group[self._smallest].popitem(last=False)
            del self._value[oldest]
            del self._uses[oldest]

        self._value[key] = value
        self._uses[key] = 1
        self._group.setdefault(1, OrderedDict())[key] = None
        # A new key has one use, and nothing can have fewer.
        self._smallest = 1

    def _promote(self, key: int) -> None:
        count = self._uses[key]
        del self._group[count][key]
        if not self._group[count] and self._smallest == count:
            # The smallest group only ever rises by one.
            self._smallest = count + 1
        self._uses[key] = count + 1
        self._group.setdefault(count + 1, OrderedDict())[key] = None
