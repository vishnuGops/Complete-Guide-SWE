class MinValueStack:
    def __init__(self) -> None:
        self._values = []
        # Parallel stack: _mins[i] is the smallest value in _values[: i + 1].
        self._mins = []

    def push(self, value: int) -> None:
        self._values.append(value)
        current_min = value if not self._mins else min(value, self._mins[-1])
        self._mins.append(current_min)

    def pop(self) -> int:
        self._mins.pop()
        return self._values.pop()

    def top(self) -> int:
        return self._values[-1]

    def smallest(self) -> int:
        return self._mins[-1]
