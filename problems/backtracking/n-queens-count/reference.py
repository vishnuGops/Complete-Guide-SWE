class Solution:
    def queenPlacements(self, n: int) -> int:
        full = (1 << n) - 1
        found = 0

        def place(columns: int, down: int, up: int) -> None:
            nonlocal found
            if columns == full:
                found += 1
                return
            # The columns this row may still use.
            free = full & ~(columns | down | up)
            while free:
                bit = free & -free      # the lowest free column
                free -= bit
                place(columns | bit, ((down | bit) << 1) & full, (up | bit) >> 1)

        place(0, 0, 0)
        return found
