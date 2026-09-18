from typing import List


class BrowserHistory:
    def __init__(self, homepage: str) -> None:
        self._pages: List[str] = [homepage]
        self._at = 0

    def visit(self, url: str) -> None:
        # Everything ahead of the current page is discarded.
        del self._pages[self._at + 1:]
        self._pages.append(url)
        self._at += 1

    def back(self, steps: int) -> str:
        self._at = max(0, self._at - steps)
        return self._pages[self._at]

    def forward(self, steps: int) -> str:
        self._at = min(len(self._pages) - 1, self._at + steps)
        return self._pages[self._at]
