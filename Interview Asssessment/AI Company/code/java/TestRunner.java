import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Zero-dependency test harness — no Maven, no Gradle, no JUnit jar.
 * Mirrors the real assessment's hidden tests. Do not edit while drilling.
 *
 *     javac *.java && java TestRunner          // all levels
 *     javac *.java && java TestRunner L2       // one level
 *
 * Exits non-zero if anything fails, so it chains in a shell.
 */
public class TestRunner {

    private static int passed = 0;
    private static final List<String> failures = new ArrayList<>();
    private static String filter = null;

    public static void main(String[] args) {
        if (args.length > 0) filter = args[0];

        // ============================ Level 1 ============================
        t("L1.addNewFileReturnsTrue", () -> {
            Solution s = new Solution();
            eq(true, s.addFile("/dir/file.txt", 10));
            eq(10, s.getFileSize("/dir/file.txt"));
        });
        t("L1.duplicateAddReturnsFalseAndDoesNotOverwrite", () -> {
            Solution s = new Solution();
            s.addFile("/a.txt", 10);
            eq(false, s.addFile("/a.txt", 999));
            eq(10, s.getFileSize("/a.txt"));
        });
        t("L1.getSizeOfMissingFileIsNull", () -> {
            isNull(new Solution().getFileSize("/nope.txt"));
        });
        t("L1.deleteReturnsSizeAndRemovesFile", () -> {
            Solution s = new Solution();
            s.addFile("/a.txt", 42);
            eq(42, s.deleteFile("/a.txt"));
            isNull(s.getFileSize("/a.txt"));
        });
        t("L1.deleteMissingFileIsNull", () -> {
            isNull(new Solution().deleteFile("/nope.txt"));
        });
        t("L1.zeroSizeFileIsValid", () -> {
            Solution s = new Solution();
            eq(true, s.addFile("/empty", 0));
            eq(0, s.getFileSize("/empty"));
        });

        // ============================ Level 2 ============================
        t("L2.ordersBySizeDescending", () -> {
            Solution s = new Solution();
            s.addFile("/x/small", 1);
            s.addFile("/x/big", 100);
            s.addFile("/x/mid", 50);
            eq(List.of("/x/big(100)", "/x/mid(50)", "/x/small(1)"), s.getNLargest("/x", 3));
        });
        t("L2.tiesBrokenByNameAscending", () -> {
            Solution s = new Solution();
            s.addFile("/x/bbb", 50);
            s.addFile("/x/aaa", 50);
            s.addFile("/x/ccc", 100);
            eq(List.of("/x/ccc(100)", "/x/aaa(50)", "/x/bbb(50)"), s.getNLargest("/x", 3));
        });
        t("L2.nLargerThanMatchCountReturnsAll", () -> {
            Solution s = new Solution();
            s.addFile("/x/a", 1);
            eq(List.of("/x/a(1)"), s.getNLargest("/x", 99));
        });
        t("L2.nZeroReturnsEmpty", () -> {
            Solution s = new Solution();
            s.addFile("/x/a", 1);
            eq(List.of(), s.getNLargest("/x", 0));
        });
        t("L2.prefixWithNoMatchReturnsEmpty", () -> {
            Solution s = new Solution();
            s.addFile("/x/a", 1);
            eq(List.of(), s.getNLargest("/y", 5));
        });
        t("L2.emptyPrefixMatchesEverything", () -> {
            Solution s = new Solution();
            s.addFile("/a", 1);
            s.addFile("/b", 2);
            eq(List.of("/b(2)", "/a(1)"), s.getNLargest("", 10));
        });
        t("L2.deletedFileIsExcluded", () -> {
            Solution s = new Solution();
            s.addFile("/x/a", 10);
            s.addFile("/x/b", 20);
            s.deleteFile("/x/b");
            eq(List.of("/x/a(10)"), s.getNLargest("/x", 5));
        });
        t("L2.prefixIsStringPrefixNotPathComponent", () -> {
            // "/dir" must also match "/dirty/..." — startsWith, not path segments.
            Solution s = new Solution();
            s.addFile("/dir/a", 1);
            s.addFile("/dirty/b", 2);
            eq(List.of("/dirty/b(2)", "/dir/a(1)"), s.getNLargest("/dir", 5));
        });

        // ============================ Level 3 ============================
        t("L3.addUserThenDuplicate", () -> {
            Solution s = new Solution();
            eq(true, s.addUser("u", 100));
            eq(false, s.addUser("u", 200));
        });
        t("L3.addFileByReturnsRemainingCapacity", () -> {
            Solution s = new Solution();
            s.addUser("u", 100);
            eq(70L, s.addFileBy("u", "/a", 30));
            eq(50L, s.addFileBy("u", "/b", 20));
        });
        t("L3.exceedingCapacityIsRejectedAtomically", () -> {
            Solution s = new Solution();
            s.addUser("u", 50);
            isNull(s.addFileBy("u", "/big", 51));
            isNull(s.getFileSize("/big"));
            eq(0L, s.addFileBy("u", "/ok", 50));   // capacity untouched by the failure
        });
        t("L3.exactFitIsAllowed", () -> {
            Solution s = new Solution();
            s.addUser("u", 50);
            eq(0L, s.addFileBy("u", "/a", 50));
        });
        t("L3.unknownUserCannotAdd", () -> {
            isNull(new Solution().addFileBy("ghost", "/a", 1));
        });
        t("L3.nameCollisionAcrossUsersIsRejected", () -> {
            Solution s = new Solution();
            s.addUser("u", 100);
            s.addUser("v", 100);
            s.addFileBy("u", "/a", 10);
            isNull(s.addFileBy("v", "/a", 10));
            eq(10, s.getFileSize("/a"));
        });
        t("L3.deleteCreditsCapacityBackToOwner", () -> {
            Solution s = new Solution();
            s.addUser("u", 100);
            s.addFileBy("u", "/a", 60);
            s.deleteFile("/a");
            eq(0L, s.addFileBy("u", "/b", 100));
        });
        t("L3.mergeMovesFilesAndSumsCapacity", () -> {
            Solution s = new Solution();
            s.addUser("a", 100);
            s.addUser("b", 200);
            s.addFileBy("a", "/a1", 10);
            s.addFileBy("b", "/b1", 20);
            eq(270L, s.mergeUser("a", "b"));       // cap 300, used 30
            eq(20, s.getFileSize("/b1"));
        });
        t("L3.mergeRemovesSourceUser", () -> {
            Solution s = new Solution();
            s.addUser("a", 100);
            s.addUser("b", 100);
            s.mergeUser("a", "b");
            isNull(s.addFileBy("b", "/x", 1));
        });
        t("L3.mergeSelfIsNull", () -> {
            Solution s = new Solution();
            s.addUser("a", 100);
            isNull(s.mergeUser("a", "a"));
        });
        t("L3.mergeUnknownUserIsNull", () -> {
            Solution s = new Solution();
            s.addUser("a", 100);
            isNull(s.mergeUser("a", "ghost"));
            isNull(s.mergeUser("ghost", "a"));
        });
        t("L3.level1StillWorksAfterUsersExist", () -> {
            // Backward compatibility: admin is not quota-limited.
            Solution s = new Solution();
            s.addUser("u", 10);
            eq(true, s.addFile("/huge", 1_000_000_000));
            eq(1_000_000_000, s.getFileSize("/huge"));
            eq(5L, s.addFileBy("u", "/small", 5));
        });

        // ============================ Level 4 ============================
        t("L4.backupReturnsFileCount", () -> {
            Solution s = new Solution();
            s.addUser("u", 100);
            s.addFileBy("u", "/a", 10);
            s.addFileBy("u", "/b", 20);
            eq(2, s.backupUser("u"));
        });
        t("L4.backupOfUnknownUserIsNull", () -> {
            isNull(new Solution().backupUser("ghost"));
        });
        t("L4.restoreOfUnknownUserIsNull", () -> {
            isNull(new Solution().restoreUser("ghost"));
        });
        t("L4.restoreDropsFilesAddedAfterBackup", () -> {
            Solution s = new Solution();
            s.addUser("u", 100);
            s.addFileBy("u", "/a", 10);
            eq(1, s.backupUser("u"));
            s.addFileBy("u", "/b", 20);
            eq(1, s.restoreUser("u"));
            isNull(s.getFileSize("/b"));
            eq(10, s.getFileSize("/a"));
            eq(0L, s.addFileBy("u", "/c", 90));    // used is back to 10
        });
        t("L4.restoreRecreatesDeletedFilesAndCapacity", () -> {
            Solution s = new Solution();
            s.addUser("u", 100);
            s.addFileBy("u", "/a", 30);
            s.backupUser("u");
            s.deleteFile("/a");
            eq(1, s.restoreUser("u"));
            eq(30, s.getFileSize("/a"));
            eq(0L, s.addFileBy("u", "/b", 70));
        });
        t("L4.restoreWithoutBackupEmptiesUser", () -> {
            Solution s = new Solution();
            s.addUser("u", 100);
            s.addFileBy("u", "/a", 10);
            eq(0, s.restoreUser("u"));
            isNull(s.getFileSize("/a"));
        });
        t("L4.restoreSkipsNameClaimedByAnotherUser", () -> {
            Solution s = new Solution();
            s.addUser("u", 100);
            s.addUser("v", 100);
            s.addFileBy("u", "/shared", 10);
            s.backupUser("u");
            s.deleteFile("/shared");
            s.addFileBy("v", "/shared", 20);
            eq(0, s.restoreUser("u"));
            eq(20, s.getFileSize("/shared"));      // v's file survives
        });
        t("L4.secondBackupReplacesFirst", () -> {
            Solution s = new Solution();
            s.addUser("u", 100);
            s.addFileBy("u", "/a", 10);
            s.backupUser("u");
            s.addFileBy("u", "/b", 20);
            eq(2, s.backupUser("u"));
            s.deleteFile("/b");
            eq(2, s.restoreUser("u"));
            eq(20, s.getFileSize("/b"));
        });
        t("L4.mergeDiscardsSourceBackup", () -> {
            Solution s = new Solution();
            s.addUser("a", 100);
            s.addUser("b", 100);
            s.addFileBy("b", "/b1", 10);
            s.backupUser("b");
            s.mergeUser("a", "b");
            isNull(s.backupUser("b"));
            isNull(s.restoreUser("b"));
        });

        report();
    }

    // ---------------------------------------------------------------- harness

    private static void t(String name, Runnable body) {
        if (filter != null && !name.startsWith(filter)) return;
        try {
            body.run();
            passed++;
            System.out.println("  PASS  " + name);
        } catch (Throwable e) {
            String msg = (e instanceof AssertionError && e.getMessage() != null)
                    ? e.getMessage()
                    : e.getClass().getSimpleName() + ": " + e.getMessage();
            failures.add(name + "  ->  " + msg);
            System.out.println("  FAIL  " + name + "\n          " + msg);
        }
    }

    private static void eq(Object expected, Object actual) {
        if (!Objects.equals(expected, actual)) {
            throw new AssertionError("expected <" + expected + "> ("
                    + typeOf(expected) + ") but was <" + actual + "> (" + typeOf(actual) + ")");
        }
    }

    private static void isNull(Object actual) {
        if (actual != null) throw new AssertionError("expected null but was <" + actual + ">");
    }

    private static String typeOf(Object o) {
        return o == null ? "null" : o.getClass().getSimpleName();
    }

    private static void report() {
        int total = passed + failures.size();
        System.out.println();
        System.out.println("------------------------------------------------------------");
        System.out.println("Ran " + total + " tests" + (filter == null ? "" : " matching \"" + filter + "\""));
        if (failures.isEmpty()) {
            System.out.println("OK - " + passed + " passed");
        } else {
            System.out.println(passed + " passed, " + failures.size() + " FAILED:");
            for (String f : failures) System.out.println("  - " + f);
            System.exit(1);
        }
    }
}
