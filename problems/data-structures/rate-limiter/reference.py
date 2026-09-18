from collections import deque


class RateLimiter:
    def __init__(self, limit: int, window: int) -> None:
        self._limit = limit
        self._window = window
        # The times of the allowed requests still inside the window.
        self._allowed = deque()

    def allow(self, at: int) -> bool:
        # Anything at or before `at - window` is outside it.
        while self._allowed and self._allowed[0] <= at - self._window:
            self._allowed.popleft()

        if len(self._allowed) < self._limit:
            self._allowed.append(at)
            return True
        # A refused request is not recorded.
        return False
