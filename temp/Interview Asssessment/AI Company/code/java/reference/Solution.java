import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/** Reference answer. Do not open until you have finished or run out of time.
 *
 *  Run the suite against this file instead of your own:
 *      javac -d out-ref -sourcepath reference reference/Solution.java TestRunner.java
 *      java -cp out-ref TestRunner
 */
public class Solution {

    private static final String ADMIN = "admin";

    private static class FileEntry {
        final String name;
        final int size;
        String owner;
        FileEntry(String name, int size, String owner) {
            this.name = name;
            this.size = size;
            this.owner = owner;
        }
    }

    private static class User {
        long cap;
        long used;
        final Set<String> files = new HashSet<>();
        User(long cap) { this.cap = cap; }
        long remaining() { return cap - used; }
    }

    private final Map<String, FileEntry> files = new HashMap<>();
    private final Map<String, User> users = new HashMap<>();
    private final Map<String, Map<String, Integer>> backups = new HashMap<>();

    public Solution() {
        users.put(ADMIN, new User(Long.MAX_VALUE / 4));
    }

    // ---------------- Level 1 ----------------

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
        if (u != null) {
            u.files.remove(name);
            u.used -= f.size;
        }
        return f.size;
    }

    // ---------------- Level 2 ----------------

    public List<String> getNLargest(String prefix, int n) {
        Comparator<FileEntry> cmp = Comparator
                .comparingInt((FileEntry f) -> f.size).reversed()
                .thenComparing((FileEntry f) -> f.name);
        return files.values().stream()
                .filter(f -> f.name.startsWith(prefix))
                .sorted(cmp)
                .limit(Math.max(0, n))
                .map(f -> f.name + "(" + f.size + ")")
                .collect(Collectors.toList());
    }

    // ---------------- Level 3 ----------------

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

    public Long mergeUser(String userId1, String userId2) {
        if (userId1.equals(userId2) || ADMIN.equals(userId1) || ADMIN.equals(userId2)) return null;
        User a = users.get(userId1);
        User b = users.get(userId2);
        if (a == null || b == null) return null;
        for (String nm : b.files) {
            files.get(nm).owner = userId1;
            a.files.add(nm);
        }
        a.cap += b.cap;
        a.used += b.used;
        users.remove(userId2);
        backups.remove(userId2);
        return a.remaining();
    }

    // ---------------- Level 4 ----------------

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
        for (String nm : new ArrayList<>(u.files)) {   // copy: avoid ConcurrentModificationException
            FileEntry f = files.remove(nm);
            if (f != null) u.used -= f.size;
        }
        u.files.clear();
        Map<String, Integer> snap = backups.get(userId);
        if (snap == null) return 0;
        int restored = 0;
        for (Map.Entry<String, Integer> e : snap.entrySet()) {
            if (files.containsKey(e.getKey())) continue;   // claimed by someone else -> skip
            files.put(e.getKey(), new FileEntry(e.getKey(), e.getValue(), userId));
            u.files.add(e.getKey());
            u.used += e.getValue();
            restored++;
        }
        return restored;
    }
}
