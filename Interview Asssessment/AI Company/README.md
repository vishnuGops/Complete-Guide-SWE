# Rentell AI — Assessment Prep

CodeSignal Industry Coding Framework (ICF) drill kit. Timed sandbox, 1–3h, Python + Java.

## What's here

```
Rentell AI/
├─ README.md                          <- you are here
├─ codesignal-icf-crash-course.md     <- read this FIRST (format, traps, full solutions)
└─ code/
   ├─ python/
   │  ├─ solution.py                  <- STUBS. this is the one you implement
   │  ├─ test_solution.py             <- runs the suite against your solution.py
   │  ├─ _cases.py                    <- the 35 test bodies (treat as hidden tests)
   │  ├─ reference_solution.py        <- the answer. don't peek
   │  └─ test_reference.py            <- proves the suite is sane (35/35 green)
   └─ java/
      ├─ Solution.java                <- STUBS. this is the one you implement
      ├─ TestRunner.java              <- same 35 tests, zero dependencies
      ├─ reference/Solution.java      <- the answer. don't peek
      └─ junit/SolutionTest.java      <- JUnit 5 syntax reference (not run locally)
```

The problem is the canonical ICF variant: an in-memory cloud storage / file system,
built over 4 levels. Full spec is in each stub file's docstrings.

## Running the tests

No pytest, Maven, or Gradle on this machine — everything below runs on stdlib only.

### Python (3.11.9)

```bash
cd "code/python"

python -m unittest test_solution -v                 # your solution, all levels
python -m unittest test_solution.TestLevel1 -v      # one level
python -m unittest test_solution.TestLevel1.test_add_new_file_returns_true
python -m unittest test_reference                   # sanity check: 35/35 OK
```

Optional, if you have network: `pip install pytest`, then `pytest -q` and
`pytest -q -k level_2` also work — the tests are written to support both.

### Java (OpenJDK 21)

```bash
cd "code/java"

javac -d out Solution.java TestRunner.java && java -cp out TestRunner       # all levels
javac -d out Solution.java TestRunner.java && java -cp out TestRunner L2    # one level

# sanity check the suite against the reference: 35/35 OK
javac -d out-ref -sourcepath reference reference/Solution.java TestRunner.java
java -cp out-ref TestRunner
```

`TestRunner` exits non-zero on failure, so it chains in a shell.
Delete `out/` and `out-ref/` whenever; they're build artifacts.

## The drill (~3 hours)

| Time | Do |
|---|---|
| 0:00–0:20 | Read `codesignal-icf-crash-course.md`. Twice on the §3 data model. |
| 0:20–1:20 | Python: implement `solution.py` L1→L4 from scratch. Run tests after every method. |
| 1:20–2:20 | Java: implement `Solution.java` L1→L4 from scratch. |
| 2:20–2:50 | Sketch the banking variant (§4) L1–L2 in your stronger language. |
| 2:50–3:00 | Re-read §7 trap list out loud. Sleep. |

Rules while drilling — these are the actual scoring conditions:

1. **Do not edit `_cases.py` or `TestRunner.java`.** They stand in for hidden tests.
2. **Never break an earlier level.** Re-run L1 after finishing L3 and L4, every time.
3. **Design the L3 data model before writing L1.** `add_file` should be a thin
   wrapper over `add_file_by("admin", …)` from the very first line you write.
4. **Time-box each level** (L1 10min, L2 15, L3 25, L4 30). Out of time → leave a
   stub returning the right type and move on. Compiling-and-partial beats
   perfect-and-unfinished, because the earlier levels' tests stay green.
5. **Boxed return types are deliberate.** `Integer`/`Long`/`None`/`null` are graded
   literally. Java trap: `assertEquals(70, …)` against a `Long` fails.

## Reset for a second run

Both stub files are self-contained — to redo the drill, restore the `TODO`
bodies (git checkout if you version this, or re-copy the method signatures out of
`solution.py` / `Solution.java` before you start editing).

## On the day

- Read every visible level description before writing line one. ~5 minutes.
- Read the provided test file before the prose — it settles every return type
  the description leaves vague.
- Run their tests after every method, not every level.
- CodeSignal ICF is usually proctored (webcam + screen recording). This folder is
  for tonight, not for the assessment window.
