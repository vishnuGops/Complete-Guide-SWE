class Solution:
    def wholeRoot(self, value: int) -> int:
        low = 0
        high = 46340  # 46341 * 46341 exceeds the largest allowed value

        while low < high:
            # Rounded up: this loop keeps `mid` when it fits.
            mid = low + (high - low + 1) // 2
            if mid * mid <= value:
                low = mid
            else:
                high = mid - 1

        return low
