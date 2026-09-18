import random
from typing import Dict, List


class RandomSet:
    def __init__(self) -> None:
        self._values: List[int] = []
        self._where: Dict[int, int] = {}
        self._rng = random.Random(1)

    def add(self, value: int) -> bool:
        if value in self._where:
            return False
        self._where[value] = len(self._values)
        self._values.append(value)
        return True

    def remove(self, value: int) -> bool:
        hole = self._where.get(value)
        if hole is None:
            return False
        last = self._values[-1]
        # Fill the hole with the last element and tell the map where it went.
        self._values[hole] = last
        self._where[last] = hole
        self._values.pop()
        del self._where[value]
        return True

    def pick(self) -> int:
        return self._values[self._rng.randrange(len(self._values))]
