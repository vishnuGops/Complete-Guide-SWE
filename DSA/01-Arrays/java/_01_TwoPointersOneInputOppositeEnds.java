public class _01_TwoPointersOneInputOppositeEnds {
    public int fn(int[] arr) {
        // "ans" stores the best area found so far.
        int ans = 0;

        // Start with pointers at opposite ends.
        int left = 0;
        int right = arr.length - 1;

        // Keep shrinking the window until pointers meet.
        while (left < right) {
            // Width is the distance between pointers.
            int width = right - left;

            // The smaller height limits the water level.
            int height = Math.min(arr[left], arr[right]);

            // Area formed by current pair of lines.
            int currentArea = width * height;

            // Update best answer if this area is larger.
            ans = Math.max(ans, currentArea);

            // Move the pointer at the shorter line.
            // Why: moving the taller line cannot improve area if the shorter
            // one stays the bottleneck; only a potentially taller short side
            // can increase min(height[left], height[right]).
            if (arr[left] < arr[right]) {
                left++;
            } else {
                right--;
            }
        }

        return ans;
    }

    static void solve() {
        // Example input: line heights.
        int[] arr = {1, 8, 6, 2, 5, 4, 8, 3, 7};

        _01_TwoPointersOneInputOppositeEnds solver = new _01_TwoPointersOneInputOppositeEnds();
        int answer = solver.fn(arr);

        System.out.println("Input heights: [1, 8, 6, 2, 5, 4, 8, 3, 7]");
        System.out.println("Maximum water area: " + answer); // Expected: 49
    }

    public static void main(String[] args) {
        solve();
    }
}
