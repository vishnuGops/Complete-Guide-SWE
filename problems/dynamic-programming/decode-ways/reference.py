class Solution:
    def waysToRead(self, digits: str) -> int:
        # Only the last two counts are ever read.
        two_back = 1                                  # one way to read nothing
        one_back = 1 if digits[0] != "0" else 0

        for at in range(1, len(digits)):
            count = 0
            if digits[at] != "0":
                count += one_back
            pair = int(digits[at - 1:at + 1])
            if 10 <= pair <= 26:
                count += two_back
            two_back, one_back = one_back, count

        return one_back
