import java.util.*;

class Solution {
    public int lastStone(int[] stones) {
        PriorityQueue<Integer> heap = new PriorityQueue<>(Comparator.reverseOrder());
        for (int weight : stones) {
            heap.offer(weight);
        }

        while (heap.size() >= 2) {
            int heaviest = heap.poll();
            int second = heap.poll();
            if (heaviest != second) {
                heap.offer(heaviest - second);
            }
        }

        return heap.isEmpty() ? 0 : heap.peek();
    }
}
