from typing import List


class StackQueue:
    def __init__(self) -> None:
        self._incoming: List[int] = []
        self._outgoing: List[int] = []

    def push(self, value: int) -> None:
        self._incoming.append(value)

    def pop(self) -> int:
        self._transfer()
        return self._outgoing.pop() if self._outgoing else -1

    def peek(self) -> int:
        self._transfer()
        return self._outgoing[-1] if self._outgoing else -1

    def empty(self) -> bool:
        return not self._incoming and not self._outgoing

    def _transfer(self) -> None:
        # Only when the outgoing stack has drained, or the order breaks.
        if not self._outgoing:
            while self._incoming:
                self._outgoing.append(self._incoming.pop())
