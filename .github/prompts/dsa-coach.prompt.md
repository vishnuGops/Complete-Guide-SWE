---
description: "Unified DSA coach: add detailed explainer headers, generate senior optimized code examples, or do both"
name: "DSA Coach"
argument-hint: "mode=header|code|both ; file paths ; optional context/skeleton"
agent: "agent"
---

Unified DSA workflow for files explicitly listed by the user.
This prompt combines:

- Detailed DSA explainer header generation
- Senior SWE interview-level optimized code example generation

Mode selection:

- `mode=header`: Only add/refresh the structured explainer header comment.
- `mode=code`: Only generate/upgrade the code example.
- `mode=both` (default): Generate/upgrade code first, then add/refresh header so docs match implementation.

Input format guidance:

- User can provide file paths and optional context/skeleton.
- Example: `mode=both DSA/01-Arrays/java/_02_TwoPointersTwoInputsExhaustBoth.java | skeleton: public int fn(...)`

Scope and safety:

1. Edit only files explicitly listed in the current request.
2. If no file is listed, ask for file path(s).
3. Preserve behavior unless the user asks for a behavior change.
4. Keep language idiomatic and project-consistent.
5. Ensure runnable scaffolding remains valid.

Inference rules:

1. Infer likely DSA problem and pattern from file name and language.
2. If user provides structure, follow it when practical.
3. If structure conflicts with correctness/optimality, apply minimal necessary adjustments and explain in summary.
4. If filename is ambiguous, choose a strong canonical problem and state what was chosen.

When mode includes code (`code` or `both`):

1. Build a senior interview-grade solution with optimized practical time/space.
2. Include comments for key decisions, invariants, and tricky transitions (avoid noisy comments).
3. Include explicit edge-case handling.
4. Keep code clean, modular, and discussion-ready for interviews.
5. Frame the problem statement in a LeetCode-like style before code comments, with:

- concise objective statement
- input format
- output format
- key constraints/assumptions
- at least one concrete example (input -> output with brief explanation)

6. Keep/ensure runnable scaffold:

- Java: class matching file name, main method and sample call
- C++: solve() and main()
- Python: solve() and `if __name__ == "__main__":`

7. Include representative sample input/output and expected-result note.
8. Add concise post-code notes as comments:

- time complexity and reason
- space complexity and reason
- one alternative approach and trade-off
- 2-4 follow-up interview extensions

When mode includes header (`header` or `both`):
Add/replace one structured top-of-file explainer comment using language-aware format:

- Java/C++: top multi-line block comment
- Python: top module docstring

Required header sections:

1. Problem (LeetCode style)

- Objective: one clear sentence of what must be solved.
- Input: exact input shape/types.
- Output: exact expected output.
- Constraints: realistic bounds and assumptions.
- Example: at least one input/output pair with short explanation.

2. Pattern (and why it fits)
3. Core Idea (3-6 bullets)
4. Step-by-Step Flow
5. Correctness Intuition (include loop invariant when relevant)
6. Complexity (time/space with short reason)
7. Optimization Notes (current optimizations + trade-offs)
8. Edge Cases
9. Pitfalls
10. Practice Extensions (2-4)

Formatting and quality:

1. Keep explanations concrete and tied to current implementation.
2. Keep line lengths readable.
3. Avoid vague textbook language; use LeetCode-like phrasing and explicit contracts.
4. Replace existing similar headers instead of duplicating.
5. Prefer active voice and simple interview-ready wording over dense theory.

Output behavior:

1. Apply edits directly.
2. Provide concise summary per file with:

- selected/inferred problem + pattern
- optimization rationale
- one key interview talking point
