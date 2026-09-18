import java.util.*;

class Solution {
    public void sortThreeKinds(int[] grades) {
        int low = 0;
        int at = 0;
        int high = grades.length - 1;

        while (at <= high) {
            if (grades[at] == 0) {
                int carried = grades[low];
                grades[low] = grades[at];
                grades[at] = carried;
                low++;
                at++;
            } else if (grades[at] == 2) {
                int carried = grades[high];
                grades[high] = grades[at];
                grades[at] = carried;
                high--;
                // `at` does not move: the value from the back is unexamined.
            } else {
                at++;
            }
        }
    }
}
