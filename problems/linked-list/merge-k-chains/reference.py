import heapq
from typing import List, Optional


class Solution:
    def mergeAll(self, chains: List[ListNode]) -> Optional[ListNode]:
        # (value, chain index, link). The index is a tie-breaker: ListNode has
        # no ordering, and heapq would try to compare two of them.
        heap = []
        for index, head in enumerate(chains):
            if head is not None:
                heapq.heappush(heap, (head.val, index, head))

        dummy = ListNode()
        tail = dummy

        while heap:
            _, index, node = heapq.heappop(heap)
            tail.next = node
            tail = node
            if node.next is not None:
                heapq.heappush(heap, (node.next.val, index, node.next))

        tail.next = None
        return dummy.next
