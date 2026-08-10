import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * JUnit 5 syntax reference — this is what the real CodeSignal Java test file
 * will look like. Not compiled by `javac *.java` (it lives in junit/ and needs
 * the JUnit jar), so it will never break your drill.
 *
 * TestRunner.java in the parent folder has the full 35-test suite and needs no
 * dependencies. Use that to drill; use this to recognize the syntax on the day.
 *
 * If you do want to run it, grab the standalone console launcher once while you
 * still have a network, then:
 *   javac -cp junit-platform-console-standalone.jar -d out ../Solution.java SolutionTest.java
 *   java -jar junit-platform-console-standalone.jar -cp out --select-class SolutionTest
 */
class SolutionTest {

    @Nested
    @DisplayName("Level 1 - basic operations")
    class Level1 {

        @Test
        void addNewFileReturnsTrue() {
            Solution s = new Solution();
            assertTrue(s.addFile("/dir/file.txt", 10));
            assertEquals(10, s.getFileSize("/dir/file.txt"));
        }

        @Test
        void duplicateAddDoesNotOverwrite() {
            Solution s = new Solution();
            s.addFile("/a.txt", 10);
            assertFalse(s.addFile("/a.txt", 999));
            assertEquals(10, s.getFileSize("/a.txt"));
        }

        @Test
        void missingFileReturnsNull() {
            assertNull(new Solution().getFileSize("/nope.txt"));
        }

        @Test
        void deleteReturnsSize() {
            Solution s = new Solution();
            s.addFile("/a.txt", 42);
            assertEquals(42, s.deleteFile("/a.txt"));
            assertNull(s.getFileSize("/a.txt"));
        }
    }

    @Nested
    @DisplayName("Level 2 - prefix search")
    class Level2 {

        @Test
        void sortsBySizeDescThenNameAsc() {
            Solution s = new Solution();
            s.addFile("/x/bbb", 50);
            s.addFile("/x/aaa", 50);
            s.addFile("/x/ccc", 100);
            assertEquals(List.of("/x/ccc(100)", "/x/aaa(50)", "/x/bbb(50)"),
                    s.getNLargest("/x", 3));
        }

        @Test
        void noMatchReturnsEmptyList() {
            assertEquals(List.of(), new Solution().getNLargest("/nothing", 5));
        }
    }

    @Nested
    @DisplayName("Level 3 - users and capacity")
    class Level3 {

        @Test
        void addFileByReturnsRemainingCapacity() {
            Solution s = new Solution();
            s.addUser("u", 100);
            // NOTE: addFileBy returns Long. assertEquals(70, ...) would compare
            // Integer to Long and fail. This boxing trap is worth remembering.
            assertEquals(70L, s.addFileBy("u", "/a", 30));
        }

        @Test
        void overCapacityIsRejected() {
            Solution s = new Solution();
            s.addUser("u", 50);
            assertNull(s.addFileBy("u", "/big", 51));
            assertNull(s.getFileSize("/big"));
        }

        @Test
        void mergeSumsCapacityAndMovesFiles() {
            Solution s = new Solution();
            s.addUser("a", 100);
            s.addUser("b", 200);
            s.addFileBy("a", "/a1", 10);
            s.addFileBy("b", "/b1", 20);
            assertEquals(270L, s.mergeUser("a", "b"));
            assertEquals(20, s.getFileSize("/b1"));
        }
    }

    @Nested
    @DisplayName("Level 4 - backup and restore")
    class Level4 {

        @Test
        void restoreDropsFilesAddedAfterBackup() {
            Solution s = new Solution();
            s.addUser("u", 100);
            s.addFileBy("u", "/a", 10);
            assertEquals(1, s.backupUser("u"));
            s.addFileBy("u", "/b", 20);
            assertEquals(1, s.restoreUser("u"));
            assertNull(s.getFileSize("/b"));
            assertEquals(10, s.getFileSize("/a"));
        }

        @Test
        void restoreSkipsNameClaimedByAnotherUser() {
            Solution s = new Solution();
            s.addUser("u", 100);
            s.addUser("v", 100);
            s.addFileBy("u", "/shared", 10);
            s.backupUser("u");
            s.deleteFile("/shared");
            s.addFileBy("v", "/shared", 20);
            assertEquals(0, s.restoreUser("u"));
            assertEquals(20, s.getFileSize("/shared"));
        }
    }
}
