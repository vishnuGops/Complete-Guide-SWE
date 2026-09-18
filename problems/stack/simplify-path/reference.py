from typing import List


class Solution:
    def tidyPath(self, path: str) -> str:
        names: List[str] = []

        for piece in path.split("/"):
            if piece == "" or piece == ".":
                continue
            if piece == "..":
                if names:
                    names.pop()
            else:
                names.append(piece)

        return "/" + "/".join(names)
