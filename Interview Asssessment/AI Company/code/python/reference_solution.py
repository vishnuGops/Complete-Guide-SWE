"""Reference answer. Do not open until you have finished or run out of time.

To run the test suite against this file instead of your own:
    python -m unittest test_reference -v
"""


class Solution:
    ADMIN = "admin"

    def __init__(self):
        self.files = {}   # name -> {"size": int, "owner": str}
        self.users = {self.ADMIN: {"cap": float("inf"), "used": 0, "files": set()}}
        self.backups = {}  # uid -> {name: size}

    # ---------------- Level 1 ----------------

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

    # ---------------- Level 2 ----------------

    def get_n_largest(self, prefix, n):
        hits = [(nm, f["size"]) for nm, f in self.files.items() if nm.startswith(prefix)]
        hits.sort(key=lambda t: (-t[1], t[0]))          # size DESC, name ASC
        return [f"{nm}({sz})" for nm, sz in hits[:n]]

    # ---------------- Level 3 ----------------

    def add_user(self, user_id, capacity):
        if user_id in self.users:
            return False
        self.users[user_id] = {"cap": capacity, "used": 0, "files": set()}
        return True

    def add_file_by(self, user_id, name, size):
        u = self.users.get(user_id)
        if u is None or name in self.files:
            return None
        if u["cap"] - u["used"] < size:                 # atomic: reject before mutating
            return None
        self.files[name] = {"size": size, "owner": user_id}
        u["files"].add(name)
        u["used"] += size
        return u["cap"] - u["used"]

    def merge_user(self, user_id1, user_id2):
        if user_id1 == user_id2 or self.ADMIN in (user_id1, user_id2):
            return None
        a, b = self.users.get(user_id1), self.users.get(user_id2)
        if a is None or b is None:
            return None
        for nm in b["files"]:
            self.files[nm]["owner"] = user_id1
            a["files"].add(nm)
        a["cap"] += b["cap"]
        a["used"] += b["used"]
        del self.users[user_id2]
        self.backups.pop(user_id2, None)
        return a["cap"] - a["used"]

    # ---------------- Level 4 ----------------

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
            if nm in self.files:                        # claimed by someone else -> skip
                continue
            self.files[nm] = {"size": sz, "owner": user_id}
            u["files"].add(nm)
            u["used"] += sz
            restored += 1
        return restored
