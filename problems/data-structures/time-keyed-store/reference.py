import bisect
from typing import Dict, List


class TimeStore:
    def __init__(self) -> None:
        # key -> (times, values), both appended in increasing time order.
        self._times: Dict[str, List[int]] = {}
        self._values: Dict[str, List[str]] = {}

    def set(self, key: str, value: str, at: int) -> None:
        if key not in self._times:
            self._times[key] = []
            self._values[key] = []
        # The times increase, so appending keeps the list sorted.
        self._times[key].append(at)
        self._values[key].append(value)

    def get(self, key: str, at: int) -> str:
        times = self._times.get(key)
        if times is None:
            return ""
        # The first entry after `at`; the answer is the one before it.
        boundary = bisect.bisect_right(times, at)
        if boundary == 0:
            return ""
        return self._values[key][boundary - 1]
