class Solution:
    def longestPalindrome(self, word: str) -> str:
        n = len(word)
        best_start = 0
        best_length = 1

        # 2n - 1 centres: one on each letter, one between each pair.
        for centre in range(2 * n - 1):
            left = centre // 2
            right = left + centre % 2
            while left >= 0 and right < n and word[left] == word[right]:
                # Strictly longer, so the earliest of a tie is kept.
                if right - left + 1 > best_length:
                    best_length = right - left + 1
                    best_start = left
                left -= 1
                right += 1

        return word[best_start:best_start + best_length]
