/*
 * ============================================================
 * EFFICIENT STRING BUILDING
 * ============================================================
 * PROBLEM (LeetCode 6 — Zigzag Conversion)
 *   Objective: Write a string in a zigzag pattern across numRows rows,
 *              then read it row by row to produce the output string.
 *   Input:     String s — printable ASCII, 1 <= s.length() <= 1000
 *              int numRows — 1 <= numRows <= 1000
 *   Output:    String — characters read left-to-right, top row first.
 *   Constraints:
 *     - 1 <= s.length() <= 1000
 *     - 1 <= numRows <= 1000
 *   Example:
 *     s = "PAYPALISHIRING", numRows = 3
 *     P   A   H   N       ← row 0
 *     A P L S I I G       ← row 1
 *     Y   I   R           ← row 2
 *     → "PAHNAPLSIIGYIR"
 *
 * PATTERN: Efficient String Building (collect into containers → join)
 *   Why it fits: the result is assembled piecemeal — each character belongs to
 *   exactly one row. Naive string concatenation (+=) is O(n²) due to Java's
 *   immutable strings. StringBuilder.append() is amortized O(1), keeping the
 *   whole algorithm O(n). This is the direct Java analog of Python's
 *   list.append() + ''.join(): collect first, materialize once.
 *
 * CORE IDEA
 *   1. Allocate one StringBuilder per row.
 *   2. Walk the input, appending each char to its target row's builder.
 *   3. Flip the traversal direction whenever row 0 or row numRows-1 is reached.
 *   4. Concatenate all row builders in order into one final result.
 *
 * STEP-BY-STEP FLOW  (s = "PAYPALISHIRING", numRows = 3)
 *   P→r0, A→r1, Y→r2↑, P→r1, A→r0↓, L→r1, I→r2↑, S→r1, H→r0↓, I→r1, R→r2↑, I→r1, N→r0↓, G→r1
 *   row0: "PAHN"
 *   row1: "APLSIIG"
 *   row2: "YIR"
 *   → "PAHNAPLSIIGYIR"
 *
 * CORRECTNESS INTUITION
 *   Each character is appended to exactly one row — none missed or duplicated.
 *   The direction-flip invariant keeps row ∈ [0, numRows-1] at all times.
 *   Reading row builders in order top-to-bottom reproduces the "row by row" read.
 *
 * COMPLEXITY
 *   Time:  O(n) — one pass to distribute chars + one pass to concat rows.
 *   Space: O(n) — total chars across all builders equals n.
 *
 * OPTIMIZATION NOTES
 *   Current: StringBuilder array + direction flag — clearest model for interviews.
 *   Alternative: math-based direct index. Zigzag period = 2*(numRows-1). For each
 *     output position, derive the source index arithmetically. O(n) time, O(1)
 *     extra space (beyond output). More complex to derive; strong follow-up answer.
 *
 * EDGE CASES
 *   - numRows == 1: no zigzag — return s unchanged (direction flip never fires).
 *   - numRows >= s.length(): each char sits on its own row — return s unchanged.
 *   - s.length() == 1: trivially s.
 *   - numRows == 2: direction flips every single step; alternating rows 0,1,0,1,...
 *
 * PITFALLS
 *   - Using String += inside the loop → O(n²); always use StringBuilder.
 *   - Forgetting the numRows == 1 early return — the direction logic misbehaves.
 *   - Not initializing each row's StringBuilder before the loop (NullPointerException).
 *   - Setting initial dir = +1 causes row 0 to immediately flip downward on char 0;
 *     starting dir = -1 and letting the boundary flip handle it is cleaner.
 *
 * PRACTICE EXTENSIONS
 *   1. LC 151  — Reverse Words in a String
 *              (split by spaces + reverse-order append + join with single space)
 *   2. LC 443  — String Compression
 *              (build compressed form in-place; two-pointer write head)
 *   3. LC 2810 — Faulty Keyboard
 *              (conditional reversal on 'i'; deque is cleaner than repeated reverse)
 *   4. LC 1163 — Last Substring in Lexicographical Order
 *              (compare suffix substrings without materializing all of them)
 * ============================================================
 */
public class _05_EfficientStringBuilding {

    // Zigzag Conversion — LeetCode 6.
    // Distribute each char to its row's builder, then join all rows.
    static String convert(String s, int numRows) {
        if (numRows == 1 || numRows >= s.length()) return s;

        StringBuilder[] rows = new StringBuilder[numRows];
        for (int i = 0; i < numRows; i++) rows[i] = new StringBuilder();

        int row = 0;
        int dir = -1;                                        // first boundary hit flips to +1 (down)

        for (char c : s.toCharArray()) {
            rows[row].append(c);
            if (row == 0 || row == numRows - 1) dir = -dir; // reverse at top and bottom rows
            row += dir;
        }

        // Java analog of Python's ''.join(list): collect once, never concatenate in the loop.
        StringBuilder result = new StringBuilder();
        for (StringBuilder sb : rows) result.append(sb);
        return result.toString();
    }

    static void solve() {
        System.out.println(convert("PAYPALISHIRING", 3));  // → "PAHNAPLSIIGYIR"
        System.out.println(convert("PAYPALISHIRING", 4));  // → "PINALSIGYAHRPI"
        System.out.println(convert("A", 1));               // → "A"   (length 1)
        System.out.println(convert("AB", 1));              // → "AB"  (numRows == 1 early return)
    }

    public static void main(String[] args) {
        solve();
    }

    // Time:  O(n) — each char appended once; all rows concatenated once.
    // Space: O(n) — chars distributed across builders sum to exactly n.
    //
    // Why not String +=?
    //   Java strings are immutable. result += c allocates a new String every iteration
    //   → total work O(1+2+...+n) = O(n²). StringBuilder uses a resizable char array
    //   → amortized O(1) per append → O(n) total. Identical reasoning to Python's
    //   list.append() + ''.join() beating str += char.
    //
    // Alternative: math-based direct index computation.
    //   Period = 2*(numRows-1). For each row r, the first character in that row
    //   sits at index r in the original string. Subsequent characters in the same
    //   row are spaced period apart, with middle rows having an interleaved
    //   secondary character at offset period - 2*r. O(n) time, O(1) extra space.
    //   Derive this in an interview as a follow-up to show mathematical depth.
    //
    // Follow-up interview extensions:
    //   1. Reconstruct the original string from a zigzag-encoded output (reverse the mapping).
    //   2. Support streaming input: chars arrive one at a time, emit rows on demand.
    //   3. What is the closed-form period formula and why is it 2*(numRows-1)?
    //   4. Generalize: instead of reversing, cycle through rows 0→n-1→0→... in a spiral.
}
