# CodeSignal Industry Coding Framework — Crash Course

**Target:** senior SWE take-home, timed sandbox (1–3h), Python + Java, multi-file, run unit tests in-IDE.

> Use this **before** the assessment. Most CodeSignal ICF runs are proctored (webcam + screen recording). Study it, then close it.

---

## 1. What this assessment actually is

CodeSignal's **Industry Coding Framework (ICF)**, sometimes labeled "Industry Coding Assessment" or "Advanced Coding Evaluation." It is *not* LeetCode. It is a **single stateful service you build over 4 progressive levels**.

| Property | Reality |
|---|---|
| Duration | Usually 90 min (sometimes 120) for all 4 levels |
| Structure | One problem, 4 levels, each level **adds requirements to the same class** |
| Files | Multiple: a solution file + a provided test file (+ sometimes helper/model files) |
| Tests | **Given to you.** You run them in the sandbox. Green tests ≈ your score |
| Backward compat | **Level 1 tests must still pass at Level 4.** This is the whole game |
| Difficulty | Algorithmically easy. It's a *code-organization and requirements-reading* test |

**Scoring:** partial credit per passing test, weighted higher on later levels. Finishing L1–L3 cleanly beats a broken half-L4. Read the scoring note on the assessment's first screen — weights vary by variant.

**Level shape (near-universal):**
- **L1** — CRUD on an in-memory store. ~10 min.
- **L2** — Query/filter/sort: prefix search, "top N", aggregation. ~15 min.
- **L3** — Ownership: users, capacity/quota limits, merge two entities. ~25 min.
- **L4** — Time travel: TTL/expiry, backup/restore, or rollback-to-timestamp. ~30 min.

---

## 2. The 5 rules that decide your score

1. **Read every level description you can see before writing line one.** Spend 5 minutes. If L3 introduces users, your L1 `addFile` should already be a thin wrapper over `addFileBy("admin", ...)`. Designing for L3 at L1 costs 2 minutes; retrofitting at L3 costs 20.
2. **Never break an earlier level.** New level = new method + widened data model. Old signatures keep their exact signature and return type. When L3 adds owners, L1 ops route to a default `admin` user with effectively infinite quota.
3. **Run the provided tests after every single method.** Do not batch. The sandbox's run button is your compiler and your grader.
4. **Return types are graded literally.** `""` vs `None`/`null` vs `"false"` vs `false` vs `-1`. Copy the exact type shown in the test file, not the prose. When prose and test disagree, **the test wins**.
5. **Budget hard, ship partial.** At the 25-minute mark on any level, if it isn't passing, comment your intent and move on. A stub that returns the right type keeps other tests green; a compile error zeroes everything.

---

## 3. The canonical problem: in-memory Cloud Storage / File System

This is *the* most-reported ICF variant and matches "filesystem test" exactly. Learn this one end to end and you'll recognize 80% of the surface area of the others.

**L1** `addFile(name, size)` → bool · `getFileSize(name)` → size|null · `deleteFile(name)` → size|null
**L2** `getNLargest(prefix, n)` → top-n names with that prefix, **size DESC, then name ASC**, formatted `name(size)`
**L3** `addUser(userId, capacity)` → bool · `addFileBy(userId, name, size)` → remaining capacity|null · `mergeUser(a, b)` → move all of b's files+capacity into a, delete b, return a's remaining
**L4** `backupUser(userId)` → count of files snapshotted · `restoreUser(userId)` → wipe current files, re-add from snapshot, **skipping names now owned by someone else**

### The data model (do this, it makes L3/L4 nearly free)

Single source of truth for files. Users hold only *names*, never copies.

```
files:   name -> { size, owner }
users:   uid  -> { cap, used, files: set<name> }
backups: uid  -> { name -> size }
```

`used` is a running counter — never recompute it by summing. Every mutation adjusts it.

### Python reference (all 4 levels)

```python
class Solution:
    ADMIN = "admin"

    def __init__(self):
        self.files = {}                 # name -> {"size": int, "owner": str}
        self.users = {self.ADMIN: {"cap": float("inf"), "used": 0, "files": set()}}
        self.backups = {}               # uid -> {name: size}

    # ---------- Level 1 ----------
    def add_file(self, name, size):
        return self.add_file_by(self.ADMIN, name, size) is not None

    def get_file_size(self, name):
        f = self.files.get(name)
        return f["size"] if f else None

    def delete_file(self, name):
        f = self.files.pop(name, None)
        if not f:
            return None
        u = self.users.get(f["owner"])
        if u:
            u["files"].discard(name)
            u["used"] -= f["size"]
        return f["size"]

    # ---------- Level 2 ----------
    def get_n_largest(self, prefix, n):
        hits = [(nm, f["size"]) for nm, f in self.files.items() if nm.startswith(prefix)]
        hits.sort(key=lambda t: (-t[1], t[0]))          # size DESC, name ASC
        return [f"{nm}({sz})" for nm, sz in hits[:n]]

    # ---------- Level 3 ----------
    def add_user(self, user_id, capacity):
        if user_id in self.users:
            return False
        self.users[user_id] = {"cap": capacity, "used": 0, "files": set()}
        return True

    def add_file_by(self, user_id, name, size):
        u = self.users.get(user_id)
        if u is None or name in self.files:
            return None
        if u["cap"] - u["used"] < size:                 # atomic: reject, never partially apply
            return None
        self.files[name] = {"size": size, "owner": user_id}
        u["files"].add(name)
        u["used"] += size
        return u["cap"] - u["used"]

    def merge_user(self, uid1, uid2):
        if uid1 == uid2 or self.ADMIN in (uid1, uid2):
            return None
        a, b = self.users.get(uid1), self.users.get(uid2)
        if a is None or b is None:
            return None
        for nm in b["files"]:
            self.files[nm]["owner"] = uid1
            a["files"].add(nm)
        a["cap"] += b["cap"]
        a["used"] += b["used"]
        del self.users[uid2]
        self.backups.pop(uid2, None)
        return a["cap"] - a["used"]

    # ---------- Level 4 ----------
    def backup_user(self, user_id):
        u = self.users.get(user_id)
        if u is None:
            return None
        self.backups[user_id] = {nm: self.files[nm]["size"] for nm in u["files"]}
        return len(self.backups[user_id])

    def restore_user(self, user_id):
        u = self.users.get(user_id)
        if u is None:
            return None
        for nm in list(u["files"]):                     # snapshot keys before mutating
            f = self.files.pop(nm, None)
            if f:
                u["used"] -= f["size"]
        u["files"].clear()
        snap = self.backups.get(user_id)
        if snap is None:
            return 0
        restored = 0
        for nm, sz in snap.items():
            if nm in self.files:                        # name stolen by another user -> skip
                continue
            self.files[nm] = {"size": sz, "owner": user_id}
            u["files"].add(nm)
            u["used"] += sz
            restored += 1
        return restored
```

### Java reference (all 4 levels)

```java
import java.util.*;
import java.util.stream.*;

public class Solution {

    private static final String ADMIN = "admin";

    private static class FileEntry {
        final String name; final int size; String owner;
        FileEntry(String name, int size, String owner) {
            this.name = name; this.size = size; this.owner = owner;
        }
    }

    private static class User {
        long cap, used;
        final Set<String> files = new HashSet<>();
        User(long cap) { this.cap = cap; }
        long remaining() { return cap - used; }
    }

    private final Map<String, FileEntry> files = new HashMap<>();
    private final Map<String, User> users = new HashMap<>();
    private final Map<String, Map<String, Integer>> backups = new HashMap<>();

    public Solution() { users.put(ADMIN, new User(Long.MAX_VALUE / 4)); }

    // ---------- Level 1 ----------
    public boolean addFile(String name, int size) {
        return addFileBy(ADMIN, name, size) != null;
    }

    public Integer getFileSize(String name) {
        FileEntry f = files.get(name);
        return f == null ? null : f.size;
    }

    public Integer deleteFile(String name) {
        FileEntry f = files.remove(name);
        if (f == null) return null;
        User u = users.get(f.owner);
        if (u != null) { u.files.remove(name); u.used -= f.size; }
        return f.size;
    }

    // ---------- Level 2 ----------
    public List<String> getNLargest(String prefix, int n) {
        Comparator<FileEntry> cmp = Comparator
            .comparingInt((FileEntry f) -> f.size).reversed()
            .thenComparing((FileEntry f) -> f.name);
        return files.values().stream()
            .filter(f -> f.name.startsWith(prefix))
            .sorted(cmp)
            .limit(n)
            .map(f -> f.name + "(" + f.size + ")")
            .collect(Collectors.toList());
    }

    // ---------- Level 3 ----------
    public boolean addUser(String userId, long capacity) {
        if (users.containsKey(userId)) return false;
        users.put(userId, new User(capacity));
        return true;
    }

    public Long addFileBy(String userId, String name, int size) {
        User u = users.get(userId);
        if (u == null || files.containsKey(name) || u.remaining() < size) return null;
        files.put(name, new FileEntry(name, size, userId));
        u.files.add(name);
        u.used += size;
        return u.remaining();
    }

    public Long mergeUser(String uid1, String uid2) {
        if (uid1.equals(uid2) || ADMIN.equals(uid1) || ADMIN.equals(uid2)) return null;
        User a = users.get(uid1), b = users.get(uid2);
        if (a == null || b == null) return null;
        for (String nm : b.files) { files.get(nm).owner = uid1; a.files.add(nm); }
        a.cap += b.cap;
        a.used += b.used;
        users.remove(uid2);
        backups.remove(uid2);
        return a.remaining();
    }

    // ---------- Level 4 ----------
    public Integer backupUser(String userId) {
        User u = users.get(userId);
        if (u == null) return null;
        Map<String, Integer> snap = new HashMap<>();
        for (String nm : u.files) snap.put(nm, files.get(nm).size);
        backups.put(userId, snap);
        return snap.size();
    }

    public Integer restoreUser(String userId) {
        User u = users.get(userId);
        if (u == null) return null;
        for (String nm : new ArrayList<>(u.files)) {     // copy: avoid ConcurrentModificationException
            FileEntry f = files.remove(nm);
            if (f != null) u.used -= f.size;
        }
        u.files.clear();
        Map<String, Integer> snap = backups.get(userId);
        if (snap == null) return 0;
        int restored = 0;
        for (Map.Entry<String, Integer> e : snap.entrySet()) {
            if (files.containsKey(e.getKey())) continue; // taken by someone else
            files.put(e.getKey(), new FileEntry(e.getKey(), e.getValue(), userId));
            u.files.add(e.getKey());
            u.used += e.getValue();
            restored++;
        }
        return restored;
    }
}
```

---

## 4. Other ICF archetypes (same skeleton, different nouns)

If it isn't the file system, it's almost certainly one of these. The data model and level progression are structurally identical.

**In-memory key-value DB**
L1 `set/get/delete` · L2 `scanByPrefix` (sorted by field asc) · L3 TTL: `setAt(k,f,v,ts)`, `setAtWithTtl(...)`, every read takes a `timestamp` · L4 backup/restore at timestamp, with **remaining TTL recalculated** relative to restore time.

**Banking system**
L1 `createAccount/deposit/pay` · L2 `topSpenders(n)` (total outgoing DESC, id ASC) · L3 `transfer` with expiry + `acceptTransfer` · L4 `mergeAccounts` and `getBalanceAt(accountId, timeAt)` — needs a per-account balance history list, then binary search.

**Cross-cutting patterns worth having in muscle memory:**
- **TTL** — store `expiresAt`; filter lazily at read time (`if expires_at is not None and ts >= expires_at: treat as absent`). Do not run a sweeper.
- **Point-in-time query** — append `(timestamp, value)` to a per-key list; `bisect_right` in Python / `Collections.binarySearch` or a `TreeMap.floorEntry(ts)` in Java.
- **Top N with tie-break** — always `sort` with a compound key. Avoid `heapq.nlargest` unless the tie-break is already encoded in the key.
- **Merge** — reject self-merge and missing entities *first*, then move children, then sum counters, then delete the source, then drop the source's backups.

---

## 5. Language-specific quick reference

### Python
```python
sorted(items, key=lambda x: (-x.size, x.name))   # DESC then ASC in one key
name.startswith(prefix)
d.get(k)              # None if absent
d.pop(k, None)        # remove-and-return, no KeyError
for k in list(d):     # iterate a snapshot when mutating d
from collections import defaultdict
import bisect; bisect.bisect_right(sorted_ts, t) - 1   # latest entry <= t
copy.deepcopy(state)  # only for nested structures; dict(d) is enough for flat
```

### Java
```java
Map<String,Integer> m = new HashMap<>();
m.getOrDefault(k, 0);  m.computeIfAbsent(k, x -> new ArrayList<>()).add(v);
m.merge(k, 1, Integer::sum);

Comparator<T> c = Comparator.comparingInt((T t) -> t.size).reversed()
                            .thenComparing((T t) -> t.name);
// explicit lambda param types after .reversed() — inference breaks without them

list.stream().filter(...).sorted(c).limit(n)
    .map(t -> t.name + "(" + t.size + ")")
    .collect(Collectors.toList());
String.join(", ", list);

TreeMap<Long,Integer> hist = new TreeMap<>();
hist.floorEntry(ts);   // latest entry <= ts — the point-in-time query, one call

for (String s : new ArrayList<>(set)) { set.remove(s); }  // copy before mutating
```

**Java nulls:** return `Integer`/`Long` (boxed) when the spec allows "no result." Returning `int` forces you into sentinel values that won't match the tests. Watch autoboxing in comparisons — use `.equals()` on boxed types, never `==`.

---

## 6. Running the tests in the sandbox

You'll have at minimum a solution file and a test file. Know both commands cold; the sandbox usually wires the Run button to one of them.

> **Drilling locally:** pytest, Maven, and Gradle are *not* installed on this machine. The kit in `code/` runs on stdlib only — `python -m unittest test_solution -v` and `javac -d out Solution.java TestRunner.java && java -cp out TestRunner`. See `README.md`.

```bash
# Python
pytest -q                      # all
pytest -q test_solution.py::test_level_1 -x    # one test, stop on first failure
pytest -q -k "level_2"         # by name substring
```

```bash
# Java — Maven or Gradle, check for pom.xml vs build.gradle
mvn -q test
mvn -q -Dtest=SolutionTest#testLevel1 test
gradle test --tests "SolutionTest.testLevel1"
```

Add your own scratch test in 20 seconds when a provided one is opaque:

```python
def test_scratch():
    s = Solution()
    assert s.add_file("/dir/f.txt", 10) is True
    assert s.get_n_largest("/dir", 2) == ["/dir/f.txt(10)"]
```

```java
@Test void scratch() {
    Solution s = new Solution();
    assertTrue(s.addFile("/dir/f.txt", 10));
    assertEquals(List.of("/dir/f.txt(10)"), s.getNLargest("/dir", 2));
}
```

**Read the provided test file first, before the prose.** It disambiguates every return type and output format the description leaves vague.

---

## 7. Trap list — the things that actually cost points

- Tie-break order wrong. "Size descending, **then name ascending**" — lexicographic, so uppercase sorts before lowercase in both languages.
- Returning fewer than N when fewer exist — slicing handles it; explicit index math doesn't.
- `n` larger than the result set, `n == 0`, empty prefix (matches everything), prefix matching nothing → must return empty list/string, not null.
- Capacity check must be all-or-nothing. Never add the file *then* discover the overflow.
- `deleteFile` must credit the **owner's** quota back — that's why files store `owner`.
- Self-merge (`a == a`), merging a nonexistent user, merging the default/admin user.
- Restore with no prior backup → empty state, not a no-op.
- Restore must not resurrect a name another user has since claimed.
- Mutating a collection while iterating it (Python `RuntimeError`, Java `ConcurrentModificationException`).
- Duplicate add returns false/null and **must not** overwrite the existing entry.
- Level 1's method signature silently changed while adding Level 3. Re-run the L1 tests after every level.

---

## 8. Tonight's plan (~3 hours, works on 24h notice)

| Time | Do this |
|---|---|
| 0:00–0:20 | Read this file. Read section 3's data model twice. |
| 0:20–1:20 | **Type the Python solution from scratch, no copying.** All 4 levels. Write 3 tests per level yourself. |
| 1:20–2:20 | Same in Java, from scratch. Get JUnit running locally so the sandbox isn't your first time. |
| 2:20–2:50 | Do the **banking** variant L1–L2 from section 4 in your stronger language. Proves the pattern transfers. |
| 2:50–3:00 | Re-read section 7 out loud. Sleep. |

**Pick your language now, not during the timer.** Python is faster to write and has no compile step — it's usually the right call for a 90-minute clock unless the role is explicitly Java. Decide tonight and drill that one twice.

**During the assessment:**
1. Read all visible level descriptions (5 min). Sketch the data model on the scratch pad.
2. Read the test file.
3. Build the L3-shaped data model immediately, even while implementing L1.
4. Run tests after every method.
5. At each level's time cap, stub and advance. Compiling and partial beats perfect and unfinished.
