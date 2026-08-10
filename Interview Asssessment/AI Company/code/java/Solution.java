import java.util.List;

/**
 * CodeSignal ICF practice — in-memory Cloud Storage / File System.
 *
 * Implement every method below. Run the tests after EVERY method:
 *
 *     javac *.java && java TestRunner
 *     javac *.java && java TestRunner L1      // one level
 *
 * Rules of the drill (same as the real assessment):
 *   - Level 1 tests must still pass when Level 4 is done. Never break a level.
 *   - Design the Level 3 data model NOW, before writing Level 1. Hint: addFile
 *     is Level 3's addFileBy with a default "admin" user of infinite capacity.
 *   - Boxed return types (Integer / Long) are deliberate: null means "no result".
 *     Do not change them to primitives.
 *   - Do not peek at reference/Solution.java until you are done or out of time.
 */
public class Solution {

    private static final String ADMIN = "admin";

    public Solution() {
        // TODO: your data model goes here.
        //
        // Suggested shape (single source of truth for files; users hold names only):
        //   Map<String, FileEntry> files;                  // name -> {size, owner}
        //   Map<String, User>      users;                  // uid  -> {cap, used, files}
        //   Map<String, Map<String, Integer>> backups;     // uid  -> {name -> size}
        //
        // Seed an ADMIN user with effectively unlimited capacity.
        throw new UnsupportedOperationException("TODO: constructor");
    }

    // ------------------------------------------------------------------
    // Level 1 — basic operations
    // ------------------------------------------------------------------

    /** Add a file owned by admin (no capacity limit). False if the name is taken.
     *  A duplicate add must NOT overwrite the existing file. */
    public boolean addFile(String name, int size) {
        throw new UnsupportedOperationException("TODO L1: addFile");
    }

    /** The file's size, or null if it does not exist. */
    public Integer getFileSize(String name) {
        throw new UnsupportedOperationException("TODO L1: getFileSize");
    }

    /** Delete the file and return its size, or null if it does not exist.
     *  Must credit the size back to the OWNER's used capacity (matters at L3). */
    public Integer deleteFile(String name) {
        throw new UnsupportedOperationException("TODO L1: deleteFile");
    }

    // ------------------------------------------------------------------
    // Level 2 — prefix search / top N
    // ------------------------------------------------------------------

    /** Top n files whose name starts with prefix.
     *  Order: size DESCENDING, then name ASCENDING. Format: "name(size)".
     *  Empty list when nothing matches. Fewer than n matches is fine. */
    public List<String> getNLargest(String prefix, int n) {
        throw new UnsupportedOperationException("TODO L2: getNLargest");
    }

    // ------------------------------------------------------------------
    // Level 3 — users, capacity, merge
    // ------------------------------------------------------------------

    /** Create a user with a total capacity. False if the id already exists. */
    public boolean addUser(String userId, long capacity) {
        throw new UnsupportedOperationException("TODO L3: addUser");
    }

    /** Add a file owned by userId. Returns the user's REMAINING capacity.
     *  null if the user is missing, the name is taken, or it would overflow the
     *  quota. The check is atomic — on failure nothing is stored. */
    public Long addFileBy(String userId, String name, int size) {
        throw new UnsupportedOperationException("TODO L3: addFileBy");
    }

    /** Move all of user2's files and capacity into user1, then delete user2.
     *  Returns user1's remaining capacity, or null if either user is missing,
     *  the ids are equal, or either id is admin. Also discards user2's backup. */
    public Long mergeUser(String userId1, String userId2) {
        throw new UnsupportedOperationException("TODO L3: mergeUser");
    }

    // ------------------------------------------------------------------
    // Level 4 — backup / restore
    // ------------------------------------------------------------------

    /** Snapshot the user's current files; returns how many were snapshotted.
     *  null if the user does not exist. A later backup replaces the earlier one. */
    public Integer backupUser(String userId) {
        throw new UnsupportedOperationException("TODO L4: backupUser");
    }

    /** Wipe the user's current files, then re-add them from the snapshot.
     *  Returns how many were actually restored, or null if the user is missing.
     *  With no prior backup the user ends up with no files (return 0).
     *  A snapshotted name another user has since claimed is skipped. */
    public Integer restoreUser(String userId) {
        throw new UnsupportedOperationException("TODO L4: restoreUser");
    }
}
