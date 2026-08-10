"""Shared test bodies. These are plain mixins, not TestCases, so the runner
only collects them once they are bound to a concrete Solution class in
test_solution.py / test_reference.py.

Do not edit while drilling — treat these as the assessment's hidden tests.
"""


class Level1Cases:
    def new(self):
        return self.SOLUTION()

    def test_add_new_file_returns_true(self):
        s = self.new()
        self.assertIs(True, s.add_file("/dir/file.txt", 10))
        self.assertEqual(10, s.get_file_size("/dir/file.txt"))

    def test_duplicate_add_returns_false_and_does_not_overwrite(self):
        s = self.new()
        s.add_file("/a.txt", 10)
        self.assertIs(False, s.add_file("/a.txt", 999))
        self.assertEqual(10, s.get_file_size("/a.txt"))

    def test_get_size_of_missing_file_is_none(self):
        self.assertIsNone(self.new().get_file_size("/nope.txt"))

    def test_delete_returns_size_and_removes_file(self):
        s = self.new()
        s.add_file("/a.txt", 42)
        self.assertEqual(42, s.delete_file("/a.txt"))
        self.assertIsNone(s.get_file_size("/a.txt"))

    def test_delete_missing_file_is_none(self):
        self.assertIsNone(self.new().delete_file("/nope.txt"))

    def test_zero_size_file_is_valid(self):
        s = self.new()
        self.assertIs(True, s.add_file("/empty", 0))
        self.assertEqual(0, s.get_file_size("/empty"))


class Level2Cases:
    def new(self):
        return self.SOLUTION()

    def test_orders_by_size_descending(self):
        s = self.new()
        s.add_file("/x/small", 1)
        s.add_file("/x/big", 100)
        s.add_file("/x/mid", 50)
        self.assertEqual(["/x/big(100)", "/x/mid(50)", "/x/small(1)"],
                         s.get_n_largest("/x", 3))

    def test_ties_broken_by_name_ascending(self):
        s = self.new()
        s.add_file("/x/bbb", 50)
        s.add_file("/x/aaa", 50)
        s.add_file("/x/ccc", 100)
        self.assertEqual(["/x/ccc(100)", "/x/aaa(50)", "/x/bbb(50)"],
                         s.get_n_largest("/x", 3))

    def test_n_larger_than_match_count_returns_all(self):
        s = self.new()
        s.add_file("/x/a", 1)
        self.assertEqual(["/x/a(1)"], s.get_n_largest("/x", 99))

    def test_n_zero_returns_empty(self):
        s = self.new()
        s.add_file("/x/a", 1)
        self.assertEqual([], s.get_n_largest("/x", 0))

    def test_prefix_with_no_match_returns_empty(self):
        s = self.new()
        s.add_file("/x/a", 1)
        self.assertEqual([], s.get_n_largest("/y", 5))

    def test_empty_prefix_matches_everything(self):
        s = self.new()
        s.add_file("/a", 1)
        s.add_file("/b", 2)
        self.assertEqual(["/b(2)", "/a(1)"], s.get_n_largest("", 10))

    def test_deleted_file_is_excluded(self):
        s = self.new()
        s.add_file("/x/a", 10)
        s.add_file("/x/b", 20)
        s.delete_file("/x/b")
        self.assertEqual(["/x/a(10)"], s.get_n_largest("/x", 5))

    def test_prefix_is_a_string_prefix_not_a_path_component(self):
        # "/dir" must also match "/dirty/..." — startswith, not path segments.
        s = self.new()
        s.add_file("/dir/a", 1)
        s.add_file("/dirty/b", 2)
        self.assertEqual(["/dirty/b(2)", "/dir/a(1)"], s.get_n_largest("/dir", 5))


class Level3Cases:
    def new(self):
        return self.SOLUTION()

    def test_add_user_then_duplicate(self):
        s = self.new()
        self.assertIs(True, s.add_user("u", 100))
        self.assertIs(False, s.add_user("u", 200))

    def test_add_file_by_returns_remaining_capacity(self):
        s = self.new()
        s.add_user("u", 100)
        self.assertEqual(70, s.add_file_by("u", "/a", 30))
        self.assertEqual(50, s.add_file_by("u", "/b", 20))

    def test_exceeding_capacity_is_rejected_atomically(self):
        s = self.new()
        s.add_user("u", 50)
        self.assertIsNone(s.add_file_by("u", "/big", 51))
        self.assertIsNone(s.get_file_size("/big"))
        self.assertEqual(0, s.add_file_by("u", "/ok", 50))  # capacity untouched

    def test_exact_fit_is_allowed(self):
        s = self.new()
        s.add_user("u", 50)
        self.assertEqual(0, s.add_file_by("u", "/a", 50))

    def test_unknown_user_cannot_add(self):
        self.assertIsNone(self.new().add_file_by("ghost", "/a", 1))

    def test_name_collision_across_users_is_rejected(self):
        s = self.new()
        s.add_user("u", 100)
        s.add_user("v", 100)
        s.add_file_by("u", "/a", 10)
        self.assertIsNone(s.add_file_by("v", "/a", 10))
        self.assertEqual(10, s.get_file_size("/a"))

    def test_delete_credits_capacity_back_to_owner(self):
        s = self.new()
        s.add_user("u", 100)
        s.add_file_by("u", "/a", 60)
        s.delete_file("/a")
        self.assertEqual(0, s.add_file_by("u", "/b", 100))

    def test_merge_moves_files_and_sums_capacity(self):
        s = self.new()
        s.add_user("a", 100)
        s.add_user("b", 200)
        s.add_file_by("a", "/a1", 10)
        s.add_file_by("b", "/b1", 20)
        self.assertEqual(270, s.merge_user("a", "b"))   # cap 300, used 30
        self.assertEqual(20, s.get_file_size("/b1"))

    def test_merge_removes_source_user(self):
        s = self.new()
        s.add_user("a", 100)
        s.add_user("b", 100)
        s.merge_user("a", "b")
        self.assertIsNone(s.add_file_by("b", "/x", 1))

    def test_merge_self_is_none(self):
        s = self.new()
        s.add_user("a", 100)
        self.assertIsNone(s.merge_user("a", "a"))

    def test_merge_unknown_user_is_none(self):
        s = self.new()
        s.add_user("a", 100)
        self.assertIsNone(s.merge_user("a", "ghost"))
        self.assertIsNone(s.merge_user("ghost", "a"))

    def test_level1_still_works_after_users_exist(self):
        # Backward compatibility: admin is not quota-limited.
        s = self.new()
        s.add_user("u", 10)
        self.assertIs(True, s.add_file("/huge", 10 ** 9))
        self.assertEqual(10 ** 9, s.get_file_size("/huge"))
        self.assertEqual(5, s.add_file_by("u", "/small", 5))


class Level4Cases:
    def new(self):
        return self.SOLUTION()

    def test_backup_returns_file_count(self):
        s = self.new()
        s.add_user("u", 100)
        s.add_file_by("u", "/a", 10)
        s.add_file_by("u", "/b", 20)
        self.assertEqual(2, s.backup_user("u"))

    def test_backup_of_unknown_user_is_none(self):
        self.assertIsNone(self.new().backup_user("ghost"))

    def test_restore_of_unknown_user_is_none(self):
        self.assertIsNone(self.new().restore_user("ghost"))

    def test_restore_drops_files_added_after_backup(self):
        s = self.new()
        s.add_user("u", 100)
        s.add_file_by("u", "/a", 10)
        self.assertEqual(1, s.backup_user("u"))
        s.add_file_by("u", "/b", 20)
        self.assertEqual(1, s.restore_user("u"))
        self.assertIsNone(s.get_file_size("/b"))
        self.assertEqual(10, s.get_file_size("/a"))
        self.assertEqual(0, s.add_file_by("u", "/c", 90))  # used is back to 10

    def test_restore_recreates_deleted_files_and_capacity(self):
        s = self.new()
        s.add_user("u", 100)
        s.add_file_by("u", "/a", 30)
        s.backup_user("u")
        s.delete_file("/a")
        self.assertEqual(1, s.restore_user("u"))
        self.assertEqual(30, s.get_file_size("/a"))
        self.assertEqual(0, s.add_file_by("u", "/b", 70))

    def test_restore_without_backup_empties_user(self):
        s = self.new()
        s.add_user("u", 100)
        s.add_file_by("u", "/a", 10)
        self.assertEqual(0, s.restore_user("u"))
        self.assertIsNone(s.get_file_size("/a"))

    def test_restore_skips_name_claimed_by_another_user(self):
        s = self.new()
        s.add_user("u", 100)
        s.add_user("v", 100)
        s.add_file_by("u", "/shared", 10)
        s.backup_user("u")
        s.delete_file("/shared")
        s.add_file_by("v", "/shared", 20)
        self.assertEqual(0, s.restore_user("u"))
        self.assertEqual(20, s.get_file_size("/shared"))  # v's file survives

    def test_second_backup_replaces_first(self):
        s = self.new()
        s.add_user("u", 100)
        s.add_file_by("u", "/a", 10)
        s.backup_user("u")
        s.add_file_by("u", "/b", 20)
        self.assertEqual(2, s.backup_user("u"))
        s.delete_file("/b")
        self.assertEqual(2, s.restore_user("u"))
        self.assertEqual(20, s.get_file_size("/b"))

    def test_merge_discards_source_backup(self):
        s = self.new()
        s.add_user("a", 100)
        s.add_user("b", 100)
        s.add_file_by("b", "/b1", 10)
        s.backup_user("b")
        s.merge_user("a", "b")
        self.assertIsNone(s.backup_user("b"))
        self.assertIsNone(s.restore_user("b"))
