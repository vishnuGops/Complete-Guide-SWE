"""
CodeSignal ICF practice — in-memory Cloud Storage / File System.

Implement every method below. Run the tests after EVERY method:

    python -m unittest -v
    python -m unittest test_solution.TestLevel1 -v

Rules of the drill (same as the real assessment):
  * Level 1 tests must still pass when Level 4 is done. Never break an earlier level.
  * Design the Level 3 data model NOW, before writing Level 1.
    Hint: files are owned. `add_file` is Level 3's `add_file_by` with a default
    "admin" user that has infinite capacity.
  * Do not peek at reference_solution.py until you are done or out of time.
"""


class Solution:
    ADMIN = "admin"

    def __init__(self):
        # TODO: your data model goes here.
        #
        # Suggested shape (single source of truth for files; users hold names only):
        #   self.files   = {}   # name -> {"size": int, "owner": str}
        #   self.users   = {}   # uid  -> {"cap": num, "used": int, "files": set[str]}
        #   self.backups = {}   # uid  -> {name: size}
        raise NotImplementedError("TODO: __init__")

    # ------------------------------------------------------------------
    # Level 1 — basic operations
    # ------------------------------------------------------------------

    def add_file(self, name, size):
        """Add a file owned by the default admin user (no capacity limit).

        Returns True if added, False if a file with `name` already exists.
        A duplicate add must NOT overwrite the existing file.
        """
        raise NotImplementedError("TODO L1: add_file")

    def get_file_size(self, name):
        """Return the file's size, or None if it does not exist."""
        raise NotImplementedError("TODO L1: get_file_size")

    def delete_file(self, name):
        """Delete the file and return its size, or None if it does not exist.

        Must credit the size back to the OWNER's used capacity (matters at L3).
        """
        raise NotImplementedError("TODO L1: delete_file")

    # ------------------------------------------------------------------
    # Level 2 — prefix search / top N
    # ------------------------------------------------------------------

    def get_n_largest(self, prefix, n):
        """Top `n` files whose name starts with `prefix`.

        Order: size DESCENDING, then name ASCENDING (lexicographic).
        Format: ["name(size)", ...]. Return [] when nothing matches.
        Fewer than `n` matches is fine — return them all.
        """
        raise NotImplementedError("TODO L2: get_n_largest")

    # ------------------------------------------------------------------
    # Level 3 — users, capacity, merge
    # ------------------------------------------------------------------

    def add_user(self, user_id, capacity):
        """Create a user with a total capacity. False if the id already exists."""
        raise NotImplementedError("TODO L3: add_user")

    def add_file_by(self, user_id, name, size):
        """Add a file owned by `user_id`. Return the user's REMAINING capacity.

        Return None if: the user does not exist, the name is taken, or the file
        would exceed the user's remaining capacity. The check is atomic — on
        failure nothing is stored and no capacity is consumed.
        """
        raise NotImplementedError("TODO L3: add_file_by")

    def merge_user(self, user_id1, user_id2):
        """Move all of user2's files and capacity into user1, then delete user2.

        Return user1's remaining capacity, or None if either user is missing,
        the ids are equal, or either id is the admin user.
        Merging must also discard user2's backup.
        """
        raise NotImplementedError("TODO L3: merge_user")

    # ------------------------------------------------------------------
    # Level 4 — backup / restore
    # ------------------------------------------------------------------

    def backup_user(self, user_id):
        """Snapshot the user's current files. Return the number snapshotted.

        Return None if the user does not exist. A later backup replaces the
        earlier one.
        """
        raise NotImplementedError("TODO L4: backup_user")

    def restore_user(self, user_id):
        """Wipe the user's current files, then re-add them from the snapshot.

        Return the number of files actually restored, or None if the user does
        not exist. With no prior backup the user simply ends up with no files
        (return 0). A snapshotted name that another user has since claimed is
        skipped, not overwritten.
        """
        raise NotImplementedError("TODO L4: restore_user")
