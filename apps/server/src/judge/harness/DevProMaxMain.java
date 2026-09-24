import java.io.IOException;
import java.io.PrintStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.io.Writer;
import java.lang.reflect.Constructor;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.ParameterizedType;
import java.lang.reflect.Type;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.IdentityHashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * DevProMax Java harness.
 *
 * Compiled alongside the user's Solution.java and started as
 * `java -cp <workspace> DevProMaxMain payload.json`.
 *
 * The contract is identical to runner.py's, deliberately: results are JSON Lines
 * flushed to a file after every test, nothing meaningful goes to stdout, and the
 * exit codes are 0 (all tests attempted), 2 (the solution could not be loaded)
 * and 3 (a per-test timeout fired and the rest were abandoned).
 *
 * Argument types come from the user's own method signature by reflection
 * (ROADMAP D5), so no metadata anywhere repeats what the starter already says.
 * The supported type table is in docs/PROBLEM_FORMAT.md §5.1 and is enforced
 * here: an unsupported parameter type fails loudly rather than silently
 * receiving null.
 */
public class DevProMaxMain {

    static final int EXIT_OK = 0;
    static final int EXIT_LOAD_FAILED = 2;
    static final int EXIT_TIMEOUT = 3;
    /** The solution called System.exit; the test that did it has its record. */
    static final int EXIT_ABANDONED = 4;

    /**
     * How long a test past its budget may take to finish a stack overflow
     * (ROADMAP P2-19).
     *
     * With `-Xss64m` a one-line runaway recursion is four million frames deep
     * before it overflows, and the error then unwinds every one of them. That
     * is half a second on this machine idle and several seconds on it busy, so
     * a StackOverflowError - the most useful thing the judge can say about
     * unbounded recursion - came back as TLE. A test that is past its budget
     * and is deep in recursion gets this long to finish: if it ends in a
     * StackOverflowError that is its verdict, and anything else is still TLE.
     * Kept under the judge's three-second stall slack, which it must not trip.
     */
    static final long OVERFLOW_GRACE_MS = 2_000;

    /**
     * A worker this many frames deep is recursing, not looping. The JVM reports
     * at most 1024 frames of another thread's stack, cheaply, so the test is
     * "did the report hit the cap"; ordinary code is a few dozen frames deep.
     */
    static final int DEEP_STACK_FRAMES = 1_000;

    /**
     * What the exit hook needs to know (ROADMAP P2-17): whether the solution
     * finished loading, which test is running, and on which thread. Guarded
     * by `STATE`, because the hook runs on a thread of its own while the
     * harness is in the middle of something.
     */
    private static final Object STATE = new Object();
    private static boolean ready;
    private static int inFlight = -1;
    private static long inFlightStarted;
    private static Thread inFlightWorker;
    /** Set before the harness's own exits, which the hook must not report. */
    private static volatile boolean harnessExiting;

    /** Per test, so one runaway println cannot exhaust the heap. */
    static final int OUTPUT_CAP = 16 * 1024;

    /**
     * The largest result line the judge will read (ROADMAP P2-13).
     *
     * A wrong subsets-style answer can be tens of megabytes. Serialised whole
     * it is parsed whole by zod and sent to the browser, where it is a wrong
     * answer nobody can scroll through anyway. Two megabytes is far more than
     * any correct answer in this catalogue.
     */
    static final int RESULT_CAP = 2 * 1024 * 1024;

    /** Matches runner.py's thread stack, so deep recursion behaves alike. */
    static final long STACK_BYTES = 64L * 1024 * 1024;

    private static Writer results;

    /**
     * A chain argument to close into a cycle, or null (ROADMAP P2-15).
     *
     * `cycleChain` is the argument index holding the values and `cycleAt` the
     * one holding the position the tail links back to; the second is consumed
     * while building the chain rather than passed to the solution, so the
     * signature the starter declares is the signature that gets called.
     *
     * Static because it is a fact about the problem rather than about a test,
     * and because the two places that need it - argument decoding and picking
     * the overload by arity - are on opposite sides of the file.
     */
    private static int cycleChain = -1;
    private static int cycleAt = -1;

    public static void main(String[] args) throws Exception {
        Map<String, Object> payload = (Map<String, Object>) DevProMaxJson.parse(
                Files.readString(Path.of(args[0]), StandardCharsets.UTF_8));

        results = Files.newBufferedWriter(
                Path.of((String) payload.get("resultsPath")), StandardCharsets.UTF_8);

        String mode = (String) payload.get("mode");
        String entry = (String) payload.get("entry");
        String expect = (String) payload.get("expect");
        long timeoutMs = ((Number) payload.get("timeoutMs")).longValue();
        List<Object> tests = (List<Object>) payload.get("tests");

        Map<String, Object> cycle = (Map<String, Object>) payload.get("cycle");
        if (cycle != null) {
            cycleChain = ((Number) cycle.get("chain")).intValue();
            cycleAt = ((Number) cycle.get("at")).intValue();
        }

        Runtime.getRuntime().addShutdownHook(
                new Thread(DevProMaxMain::reportExit, "devpromax-exit-hook"));

        Class<?> target;
        String wanted = mode.equals("operations") ? entry : "Solution";
        Method method = null;
        try {
            target = Class.forName(wanted);
            if (!mode.equals("operations")) {
                method = findMethod(target, entry, tests);
                if (method == null) {
                    loadFailed("Solution has no method named " + entry, "");
                    return;
                }
            }
        } catch (ClassNotFoundException err) {
            loadFailed("the compiled solution does not define " + wanted, "");
            return;
        } catch (Throwable err) {
            /*
             * `Class.forName` runs the class's static initialisers, which are
             * the user's code (ROADMAP P2-17). One that throws used to escape
             * `main`, the JVM printed it and exited 1 with no record, and the
             * judge reported "the process exited" once per test. What failed
             * is the solution's own initialiser, so that is what is reported.
             */
            Throwable cause = err instanceof ExceptionInInitializerError && err.getCause() != null
                    ? err.getCause()
                    : err;
            String detail = cause.getMessage() == null ? "" : ": " + cause.getMessage();
            loadFailed(
                    (cause == err ? "" : "a static initialiser threw ")
                            + cause.getClass().getSimpleName() + detail,
                    stackTrace(cause));
            return;
        }

        synchronized (STATE) {
            ready = true;
        }
        Map<String, Object> readyRecord = new LinkedHashMap<>();
        readyRecord.put("event", "ready");
        writeRecord(readyRecord);

        int exit = EXIT_OK;
        for (Object raw : tests) {
            Map<String, Object> test = (Map<String, Object>) raw;
            int index = ((Number) test.get("index")).intValue();
            if (!runOne(index, mode, target, method, entry, expect, test, timeoutMs)) {
                exit = EXIT_TIMEOUT;
                break;
            }
        }

        results.flush();
        results.close();
        harnessExiting = true;
        System.exit(exit);
    }

    private static void loadFailed(String message, String traceback) {
        writeFatal("load", message, traceback);
        harnessExiting = true;
        System.exit(EXIT_LOAD_FAILED);
    }

    /**
     * The shutdown hook: the solution called `System.exit` (ROADMAP P2-17).
     *
     * That ends the JVM from inside a test, and the test's record was never
     * written - so the judge saw a batch that stopped early, re-ran every
     * remaining test in isolation, and each one reported "the process exited"
     * for a test that had not called anything. The hook records the exit
     * against the test that made it, with the frames that made it, and halts
     * with a code that tells the judge the rest were abandoned rather than
     * crashed. The harness's own exits set `harnessExiting` first; a halt,
     * which the timeout path uses, never runs hooks at all.
     */
    private static void reportExit() {
        if (harnessExiting) {
            return;
        }
        synchronized (STATE) {
            if (!ready) {
                writeFatal("load",
                        "the solution called System.exit while its classes were loading, "
                                + "which ends the judge's process before any test can run",
                        "");
                Runtime.getRuntime().halt(EXIT_LOAD_FAILED);
                return;
            }
            if (inFlight < 0) {
                return;
            }
            Map<String, Object> record = new LinkedHashMap<>();
            record.put("index", inFlight);
            record.put("status", "error");
            record.put("timeMs", (System.nanoTime() - inFlightStarted) / 1_000_000.0);
            Map<String, Object> error = new LinkedHashMap<>();
            error.put("type", "SystemExit");
            error.put("message", "the solution called System.exit, which ends the judge's process;"
                    + " return the answer instead");
            error.put("traceback", inFlightWorker == null ? "" : framesOf(inFlightWorker));
            record.put("error", error);
            inFlight = -1;
            try {
                writeRecord(record);
            } catch (IOException | RuntimeException ignored) {
                // The judge reports the missing record as a crash instead.
            }
        }
        Runtime.getRuntime().halt(EXIT_ABANDONED);
    }

    /** Another thread's frames as a stack trace reads, for the exit report. */
    private static String framesOf(Thread thread) {
        StringBuilder out = new StringBuilder();
        boolean inUserCode = false;
        for (StackTraceElement frame : thread.getStackTrace()) {
            // The top is the JDK's own shutdown machinery, waiting on this
            // hook; the story starts at the first frame that is not.
            String owner = frame.getClassName();
            if (!inUserCode && (owner.startsWith("java.") || owner.startsWith("jdk."))) {
                continue;
            }
            inUserCode = true;
            out.append("\tat ").append(frame).append('\n');
            if (out.length() > OUTPUT_CAP) {
                break;
            }
        }
        return out.length() > OUTPUT_CAP ? out.substring(0, OUTPUT_CAP) : out.toString();
    }

    /**
     * Runs one test on a worker thread with a large stack.
     *
     * @return false when the test exceeded its budget, in which case the record
     *         has already been written and the remaining tests are left to the
     *         judge - a runaway thread cannot be stopped safely in modern Java,
     *         so the only honest option is to halt and let the judge re-run the
     *         rest one process each.
     */
    private static boolean runOne(int index, String mode, Class<?> target, Method method,
            String entry, String expect, Map<String, Object> test, long timeoutMs)
            throws IOException {

        DevProMaxCappedStream outBuffer = new DevProMaxCappedStream(OUTPUT_CAP);
        DevProMaxCappedStream errBuffer = new DevProMaxCappedStream(OUTPUT_CAP);
        PrintStream realOut = System.out;
        PrintStream realErr = System.err;

        Map<String, Object> record = new LinkedHashMap<>();
        record.put("index", index);

        final Object[] outcome = new Object[2]; // [result map, throwable]
        Runnable body = () -> {
            try {
                outcome[0] = mode.equals("operations")
                        ? runOperations(target, entry, test)
                        : runFunction(target, method, expect, test);
            } catch (Throwable err) {
                outcome[1] = err;
            }
        };

        Thread worker = new Thread(null, body, "devpromax-test-" + index, STACK_BYTES);
        worker.setDaemon(true);

        long started = System.nanoTime();
        System.setOut(new PrintStream(outBuffer, true, StandardCharsets.UTF_8));
        System.setErr(new PrintStream(errBuffer, true, StandardCharsets.UTF_8));
        synchronized (STATE) {
            inFlight = index;
            inFlightStarted = started;
            inFlightWorker = worker;
        }
        worker.start();
        join(worker, timeoutMs);
        boolean overBudget = worker.isAlive();
        if (overBudget && worker.getStackTrace().length >= DEEP_STACK_FRAMES) {
            // Possibly a stack overflow still unwinding; see OVERFLOW_GRACE_MS.
            join(worker, OVERFLOW_GRACE_MS);
        }
        boolean stillRunning = worker.isAlive();
        double elapsedMs = (System.nanoTime() - started) / 1_000_000.0;
        System.setOut(realOut);
        System.setErr(realErr);

        synchronized (STATE) {
            if (inFlight != index) {
                // The exit hook has reported this test and the JVM is going
                // down; nothing written here would be read.
                return false;
            }
            inFlight = -1;
            inFlightWorker = null;
        }

        // Reflection wraps what the solution threw; the overflow is inside.
        Throwable thrown = (Throwable) outcome[1];
        if (thrown instanceof InvocationTargetException && thrown.getCause() != null) {
            thrown = thrown.getCause();
        }
        boolean overflowed = thrown instanceof StackOverflowError;
        if (stillRunning || (overBudget && !overflowed)) {
            record.put("status", "timeout");
            record.put("timeMs", (double) timeoutMs);
            writeRecord(record);
            results.flush();
            if (!stillRunning) {
                // It finished, late: over budget is a TLE whatever it
                // returned, but nothing is left running, so the batch goes on.
                return true;
            }
            // The worker is still burning CPU and cannot be stopped; halt rather
            // than let it skew every timing that follows.
            Runtime.getRuntime().halt(EXIT_TIMEOUT);
            return false;
        }

        if (outcome[1] != null) {
            Throwable err = (Throwable) outcome[1];
            if (err instanceof InvocationTargetException && err.getCause() != null) {
                err = err.getCause();
            }
            record.put("status", "error");
            Map<String, Object> error = new LinkedHashMap<>();

            if (err instanceof DevProMaxOperationException failure) {
                // The returns collected before the failure are kept: being able
                // to count the calls that worked is most of reading this (P2-12).
                record.put("returned", failure.returns);
                error.put("type", failure.opCause.getClass().getSimpleName());
                error.put("message", failure.getMessage());
                error.put("traceback", stackTrace(failure.opCause));
            } else {
                error.put("type", err.getClass().getSimpleName());
                error.put("message", err.getMessage() == null ? "" : err.getMessage());
                error.put("traceback", stackTrace(err));
            }
            record.put("error", error);
        } else {
            record.put("status", "ok");
            record.putAll((Map<String, Object>) outcome[0]);
        }

        record.put("timeMs", elapsedMs);
        record.put("stdout", outBuffer.text());
        record.put("stderr", errBuffer.text());
        if (outBuffer.truncated() || errBuffer.truncated()) {
            record.put("outputTruncated", true);
        }

        try {
            writeRecord(record);
        } catch (DevProMaxResultTooLarge tooLarge) {
            // The test fails; the run carries on. Reported as a serialisation
            // error rather than as a wrong answer, because the answer was never
            // compared - it was too big to carry (P2-13).
            Map<String, Object> replacement = new LinkedHashMap<>();
            replacement.put("index", index);
            replacement.put("status", "error");
            replacement.put("timeMs", elapsedMs);
            Map<String, Object> error = new LinkedHashMap<>();
            error.put("type", "SerialisationError");
            error.put("message", tooLarge.getMessage());
            error.put("traceback", "");
            replacement.put("error", error);
            writeRecord(replacement);
        }
        return true;
    }

    private static void join(Thread worker, long ms) {
        try {
            worker.join(ms);
        } catch (InterruptedException ignored) {
            Thread.currentThread().interrupt();
        }
    }

    // -----------------------------------------------------------------------
    // Test modes
    // -----------------------------------------------------------------------

    private static Map<String, Object> runFunction(Class<?> target, Method method, String expect,
            Map<String, Object> test) throws Exception {
        Object instance = target.getDeclaredConstructor().newInstance();
        List<Object> rawArgs = (List<Object>) test.get("args");
        Type[] types = method.getGenericParameterTypes();

        Object[] args = new Object[types.length];
        if (cycleAt >= 0) {
            /*
             * One argument holds the values and another holds the position the
             * tail links back to (P2-15). The second never reaches the
             * solution, so the wire list is one longer than the parameter list
             * and the two are walked with separate cursors.
             */
            int at = 0;
            for (int i = 0; i < rawArgs.size(); i++) {
                if (i == cycleAt) {
                    continue;
                }
                args[at] = i == cycleChain
                        ? DevProMaxConvert.toCyclicListNode(
                                rawArgs.get(i), ((Number) rawArgs.get(cycleAt)).intValue())
                        : DevProMaxConvert.toJava(rawArgs.get(i), types[at]);
                at++;
            }
        } else {
            for (int i = 0; i < types.length; i++) {
                args[i] = DevProMaxConvert.toJava(rawArgs.get(i), types[i]);
            }
        }

        method.setAccessible(true);
        Object returned = method.invoke(instance, args);

        Map<String, Object> out = new LinkedHashMap<>();
        if (expect.equals("return") || expect.equals("both")) {
            out.put("returned", method.getReturnType() == void.class
                    ? null
                    : DevProMaxConvert.toJson(returned));
        }
        if (expect.equals("mutatedArgs") || expect.equals("both")) {
            List<Object> mutated = new ArrayList<>();
            for (int i = 0; i < args.length; i++) {
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("index", i);
                entry.put("value", DevProMaxConvert.toJson(args[i]));
                mutated.add(entry);
            }
            out.put("mutatedArgs", mutated);
        }
        return out;
    }

    private static Map<String, Object> runOperations(Class<?> target, String entry,
            Map<String, Object> test) throws Exception {
        List<Object> ctorArgs = (List<Object>) test.get("args");
        Constructor<?> ctor = findConstructor(target, ctorArgs.size());
        if (ctor == null) {
            throw new NoSuchMethodException(
                    entry + " has no constructor taking " + ctorArgs.size() + " argument(s)");
        }
        ctor.setAccessible(true);
        Type[] ctorTypes = ctor.getGenericParameterTypes();
        Object[] built = new Object[ctorTypes.length];
        for (int i = 0; i < ctorTypes.length; i++) {
            built[i] = DevProMaxConvert.toJava(ctorArgs.get(i), ctorTypes[i]);
        }
        Object instance = ctor.newInstance(built);

        List<Object> ops = (List<Object>) test.get("ops");
        List<Object> returns = new ArrayList<>();
        if (ops != null) {
            for (int opIndex = 0; opIndex < ops.size(); opIndex++) {
                Map<String, Object> op = (Map<String, Object>) ops.get(opIndex);
                String name = (String) op.get("method");
                List<Object> opArgs = (List<Object>) op.get("args");
                if (opArgs == null) {
                    opArgs = List.of();
                }
                try {
                    Method m = findMethodByArity(target, name, opArgs.size());
                    if (m == null) {
                        throw new NoSuchMethodException(
                                entry + " has no method " + name + " taking " + opArgs.size()
                                        + " argument(s)");
                    }
                    m.setAccessible(true);
                    Type[] types = m.getGenericParameterTypes();
                    Object[] args = new Object[types.length];
                    for (int i = 0; i < types.length; i++) {
                        args[i] = DevProMaxConvert.toJava(opArgs.get(i), types[i]);
                    }
                    Object returned = m.invoke(instance, args);
                    returns.add(
                            m.getReturnType() == void.class ? null : DevProMaxConvert.toJson(returned));
                } catch (Throwable err) {
                    // Which call failed, and what the sequence produced up to it
                    // (ROADMAP P2-12). A design problem is a sequence of calls, and
                    // "it threw IndexOutOfBounds" with no index is a needle in
                    // twenty haystacks.
                    Throwable cause =
                            err instanceof InvocationTargetException && err.getCause() != null
                                    ? err.getCause()
                                    : err;
                    throw new DevProMaxOperationException(opIndex, name, cause, returns);
                }
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("returned", returns);
        return out;
    }

    // -----------------------------------------------------------------------
    // Reflection helpers
    // -----------------------------------------------------------------------

    private static Method findMethod(Class<?> target, String name, List<Object> tests) {
        int arity = -1;
        if (!tests.isEmpty()) {
            Map<String, Object> first = (Map<String, Object>) tests.get(0);
            arity = ((List<Object>) first.get("args")).size();
            // The cycle index is not a parameter, so it does not count towards
            // the arity the overload is chosen by (P2-15).
            if (cycleAt >= 0) {
                arity--;
            }
        }
        Method fallback = null;
        for (Method m : target.getDeclaredMethods()) {
            if (!m.getName().equals(name) || m.isSynthetic()) {
                continue;
            }
            if (m.getParameterCount() == arity) {
                return m;
            }
            fallback = m;
        }
        return fallback;
    }

    private static Method findMethodByArity(Class<?> target, String name, int arity) {
        for (Method m : target.getDeclaredMethods()) {
            if (m.getName().equals(name) && m.getParameterCount() == arity && !m.isSynthetic()) {
                return m;
            }
        }
        for (Method m : target.getMethods()) {
            if (m.getName().equals(name) && m.getParameterCount() == arity && !m.isSynthetic()) {
                return m;
            }
        }
        return null;
    }

    private static Constructor<?> findConstructor(Class<?> target, int arity) {
        for (Constructor<?> c : target.getDeclaredConstructors()) {
            if (c.getParameterCount() == arity) {
                return c;
            }
        }
        return null;
    }

    // -----------------------------------------------------------------------
    // Output
    // -----------------------------------------------------------------------

    private static String stackTrace(Throwable err) {
        StringWriter writer = new StringWriter();
        err.printStackTrace(new PrintWriter(writer));
        String text = writer.toString();
        return text.length() > OUTPUT_CAP ? text.substring(0, OUTPUT_CAP) : text;
    }

    private static synchronized void writeRecord(Map<String, Object> record) throws IOException {
        String line = DevProMaxJson.write(record);
        if (line.length() > RESULT_CAP) {
            throw new DevProMaxResultTooLarge(String.format(
                    "the result is %.1f MB, past the %d MB the judge will carry",
                    line.length() / 1024.0 / 1024.0, RESULT_CAP / (1024 * 1024)));
        }
        results.write(line);
        results.write("\n");
        results.flush();
    }

    private static void writeFatal(String kind, String message, String traceback) {
        try {
            Map<String, Object> record = new LinkedHashMap<>();
            record.put("event", "fatal");
            record.put("kind", kind);
            record.put("message", message);
            record.put("traceback", traceback);
            writeRecord(record);
            results.flush();
        } catch (IOException ignored) {
            // Nothing useful to do; the judge reports the exit code instead.
        }
    }

    // =======================================================================
    // ListNode / TreeNode - visible to the user's solution, which is compiled
    // in the same default package.
    // =======================================================================
}

/** A result too big to send as it stands (ROADMAP P2-13). */
final class DevProMaxResultTooLarge extends RuntimeException {
    DevProMaxResultTooLarge(String message) {
        super(message);
    }
}

/**
 * An output stream that stops storing past a cap (ROADMAP P2-13).
 *
 * The `ByteArrayOutputStream` this replaces grew without bound and was capped
 * only afterwards, so `while (true) System.out.println(x)` filled `-Xmx` before
 * the per-test watchdog fired - and the OutOfMemoryError was then reported as
 * MLE, blaming the user's memory use for their print loop. Writes past the cap
 * are dropped as they arrive, so a print storm costs time and nothing else.
 */
final class DevProMaxCappedStream extends java.io.OutputStream {

    private final byte[] buffer;
    private int length;
    private boolean truncated;

    DevProMaxCappedStream(int cap) {
        this.buffer = new byte[cap];
    }

    @Override
    public void write(int b) {
        if (length >= buffer.length) {
            truncated = true;
            return;
        }
        buffer[length++] = (byte) b;
    }

    @Override
    public void write(byte[] bytes, int offset, int count) {
        int room = buffer.length - length;
        if (room <= 0) {
            truncated = true;
            return;
        }
        int taken = Math.min(room, count);
        System.arraycopy(bytes, offset, buffer, length, taken);
        length += taken;
        if (taken < count) {
            truncated = true;
        }
    }

    boolean truncated() {
        return truncated;
    }

    String text() {
        return new String(buffer, 0, length, StandardCharsets.UTF_8);
    }
}

/** A failure during one call of an operations sequence (ROADMAP P2-12). */
final class DevProMaxOperationException extends RuntimeException {

    final int index;
    final String method;
    /** Named to avoid shadowing `Throwable.getCause()`, which is not set here. */
    final transient Throwable opCause;
    final transient List<Object> returns;

    DevProMaxOperationException(int index, String method, Throwable cause, List<Object> returns) {
        super("operation " + index + " (" + method + ") threw "
                + cause.getClass().getSimpleName()
                + (cause.getMessage() == null ? "" : ": " + cause.getMessage()));
        this.index = index;
        this.method = method;
        this.opCause = cause;
        // `new ArrayList<>` rather than `List.copyOf`: a void method
        // contributes a null return, and `copyOf` throws on nulls - which
        // turned every failing operation into a NullPointerException from
        // inside the harness.
        this.returns = new ArrayList<>(returns);
    }
}

class ListNode {
    int val;
    ListNode next;

    ListNode() {
    }

    ListNode(int val) {
        this.val = val;
    }

    ListNode(int val, ListNode next) {
        this.val = val;
        this.next = next;
    }
}

class TreeNode {
    int val;
    TreeNode left;
    TreeNode right;

    TreeNode() {
    }

    TreeNode(int val) {
        this.val = val;
    }

    TreeNode(int val, TreeNode left, TreeNode right) {
        this.val = val;
        this.left = left;
        this.right = right;
    }
}

/**
 * JSON <-> Java conversion driven by the declared parameter and return types.
 *
 * The supported set is fixed and documented (docs/PROBLEM_FORMAT.md §5.1).
 * Anything outside it throws, because the alternative - quietly passing null -
 * turns a problem-authoring mistake into a baffling NullPointerException inside
 * the user's solution.
 */
final class DevProMaxConvert {

    private DevProMaxConvert() {
    }

    static Object toJava(Object value, Type type) {
        if (type instanceof Class<?> cls) {
            return toJavaClass(value, cls);
        }
        if (type instanceof ParameterizedType parameterized) {
            return toJavaParameterized(value, parameterized);
        }
        throw new IllegalArgumentException("unsupported parameter type: " + type);
    }

    private static Object toJavaClass(Object value, Class<?> cls) {
        if (cls == int.class || cls == Integer.class) {
            return (int) requireIntegral(value, "an integer");
        }
        if (cls == long.class || cls == Long.class) {
            return requireIntegral(value, "an integer");
        }
        if (cls == double.class || cls == Double.class) {
            return ((Number) require(value, "a number")).doubleValue();
        }
        if (cls == boolean.class || cls == Boolean.class) {
            return (Boolean) require(value, "a boolean");
        }
        if (cls == char.class || cls == Character.class) {
            String text = (String) require(value, "a one-character string");
            if (text.length() != 1) {
                throw new IllegalArgumentException(
                        "expected a one-character string for a char parameter, got \"" + text + "\"");
            }
            return text.charAt(0);
        }
        if (cls == String.class) {
            return value == null ? null : (String) value;
        }
        if (cls == ListNode.class) {
            return toListNode(value);
        }
        if (cls == TreeNode.class) {
            return toTreeNode(value);
        }
        if (cls.isArray()) {
            return toArray(value, cls.getComponentType());
        }
        if (cls == Object.class) {
            return value;
        }
        throw new IllegalArgumentException(
                "unsupported parameter type " + cls.getName() + "; see docs/PROBLEM_FORMAT.md §5.1");
    }

    private static Object toJavaParameterized(Object value, ParameterizedType type) {
        Class<?> raw = (Class<?>) type.getRawType();
        if (!List.class.isAssignableFrom(raw)) {
            throw new IllegalArgumentException(
                    "unsupported parameter type " + type + "; see docs/PROBLEM_FORMAT.md §5.1");
        }
        if (value == null) {
            return null;
        }
        List<Object> source = (List<Object>) require(value, "a list");
        Type element = type.getActualTypeArguments()[0];
        List<Object> out = new ArrayList<>(source.size());
        for (Object item : source) {
            out.add(toJava(item, element));
        }
        return out;
    }

    private static Object toArray(Object value, Class<?> component) {
        if (value == null) {
            return null;
        }
        List<Object> source = (List<Object>) require(value, "a list");
        int n = source.size();

        if (component == int.class) {
            int[] out = new int[n];
            for (int i = 0; i < n; i++) {
                out[i] = (int) requireIntegral(source.get(i), "an integer");
            }
            return out;
        }
        if (component == long.class) {
            long[] out = new long[n];
            for (int i = 0; i < n; i++) {
                out[i] = requireIntegral(source.get(i), "an integer");
            }
            return out;
        }
        if (component == double.class) {
            double[] out = new double[n];
            for (int i = 0; i < n; i++) {
                out[i] = ((Number) source.get(i)).doubleValue();
            }
            return out;
        }
        if (component == boolean.class) {
            boolean[] out = new boolean[n];
            for (int i = 0; i < n; i++) {
                out[i] = (Boolean) source.get(i);
            }
            return out;
        }
        if (component == char.class) {
            char[] out = new char[n];
            for (int i = 0; i < n; i++) {
                out[i] = requireChar(source.get(i), i);
            }
            return out;
        }
        if (component == String.class) {
            String[] out = new String[n];
            for (int i = 0; i < n; i++) {
                out[i] = (String) source.get(i);
            }
            return out;
        }
        if (component == ListNode.class) {
            ListNode[] out = new ListNode[n];
            for (int i = 0; i < n; i++) {
                out[i] = (ListNode) toListNode(source.get(i));
            }
            return out;
        }
        if (component.isArray()) {
            Object out = java.lang.reflect.Array.newInstance(component, n);
            for (int i = 0; i < n; i++) {
                java.lang.reflect.Array.set(out, i, toArray(source.get(i), component.getComponentType()));
            }
            return out;
        }
        throw new IllegalArgumentException(
                "unsupported array element type " + component.getName()
                        + "; see docs/PROBLEM_FORMAT.md §5.1");
    }

    private static Object require(Object value, String what) {
        if (value == null) {
            throw new IllegalArgumentException("expected " + what + ", got null");
        }
        return value;
    }

    /**
     * A whole number, refused rather than truncated (ROADMAP P2-12).
     *
     * `intValue()` on 2.5 is 2, which made a test whose input was written as a
     * float pass against the wrong argument and left no trace of why. The wire
     * format is JSON, where 2 and 2.0 are the same token, so an integral double
     * is accepted and anything with a fractional part is not.
     */
    private static long requireIntegral(Object value, String what) {
        Number number = (Number) require(value, what);
        double asDouble = number.doubleValue();
        if (asDouble != Math.rint(asDouble) || Double.isNaN(asDouble) || Double.isInfinite(asDouble)) {
            throw new IllegalArgumentException(
                    "expected " + what + " for this parameter, got " + number);
        }
        return number.longValue();
    }

    /** One character, and says which element was not (ROADMAP P2-12). */
    private static char requireChar(Object value, int index) {
        String text = (String) require(value, "a one-character string");
        if (text.length() != 1) {
            // `charAt(0)` on "" threw StringIndexOutOfBounds from inside the
            // harness, which reads as the judge being broken rather than the
            // test data being wrong.
            throw new IllegalArgumentException(
                    "expected a one-character string at index " + index + " of a char[], got \"" + text + "\"");
        }
        return text.charAt(0);
    }

    // --- node conversions -------------------------------------------------

    static Object toListNode(Object value) {
        if (value == null) {
            return null;
        }
        List<Object> values = (List<Object>) value;
        ListNode head = null;
        for (int i = values.size() - 1; i >= 0; i--) {
            head = new ListNode(((Number) values.get(i)).intValue(), head);
        }
        return head;
    }

    /**
     * A chain whose tail points back at index `at` (ROADMAP P2-15).
     *
     * `at` is -1 for no cycle, which is an ordinary chain. The index is into
     * the values as given, so `([3, 2, 0, -4], 1)` is four nodes with the last
     * pointing at the second. The solution is handed a chain that loops rather
     * than being told that it does, which is the whole point of a problem
     * about detecting one.
     */
    static Object toCyclicListNode(Object value, int at) {
        Object head = toListNode(value);
        if (head == null || at < 0) {
            return head;
        }
        List<Object> values = (List<Object>) value;
        if (at >= values.size()) {
            throw new IllegalArgumentException(
                    "cycle index " + at + " is past the end of a chain of " + values.size());
        }

        ListNode target = (ListNode) head;
        for (int i = 0; i < at; i++) {
            target = target.next;
        }
        ListNode tail = (ListNode) head;
        while (tail.next != null) {
            tail = tail.next;
        }
        tail.next = target;
        return head;
    }

    static Object toTreeNode(Object value) {
        if (value == null) {
            return null;
        }
        List<Object> values = (List<Object>) value;
        if (values.isEmpty() || values.get(0) == null) {
            return null;
        }
        TreeNode root = new TreeNode(((Number) values.get(0)).intValue());
        Deque<TreeNode> queue = new ArrayDeque<>();
        queue.add(root);
        int i = 1;
        while (!queue.isEmpty() && i < values.size()) {
            TreeNode node = queue.poll();
            if (i < values.size()) {
                Object left = values.get(i++);
                if (left != null) {
                    node.left = new TreeNode(((Number) left).intValue());
                    queue.add(node.left);
                }
            }
            if (i < values.size()) {
                Object right = values.get(i++);
                if (right != null) {
                    node.right = new TreeNode(((Number) right).intValue());
                    queue.add(node.right);
                }
            }
        }
        return root;
    }

    static List<Object> fromListNode(ListNode node) {
        List<Object> out = new ArrayList<>();
        IdentityHashMap<ListNode, Boolean> seen = new IdentityHashMap<>();
        while (node != null) {
            if (seen.put(node, Boolean.TRUE) != null) {
                throw new IllegalStateException("the returned linked list contains a cycle");
            }
            out.add(node.val);
            node = node.next;
        }
        return out;
    }

    static List<Object> fromTreeNode(TreeNode root) {
        List<Object> out = new ArrayList<>();
        if (root == null) {
            return out;
        }
        // An ArrayList read with an index, not an ArrayDeque: the level order
        // this format uses puts a null in the queue for every absent child, and
        // ArrayDeque refuses null elements. Encoding any tree with a missing
        // child threw a NullPointerException from inside the harness until
        // ROADMAP P6-4, when flatten-to-chain became the first catalogue
        // problem to hand a tree back.
        List<TreeNode> queue = new ArrayList<>();
        queue.add(root);
        for (int at = 0; at < queue.size(); at++) {
            TreeNode node = queue.get(at);
            if (node == null) {
                out.add(null);
                continue;
            }
            out.add(node.val);
            queue.add(node.left);
            queue.add(node.right);
        }
        while (!out.isEmpty() && out.get(out.size() - 1) == null) {
            out.remove(out.size() - 1);
        }
        return out;
    }

    // --- outgoing ---------------------------------------------------------

    static Object toJson(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof ListNode node) {
            return fromListNode(node);
        }
        if (value instanceof TreeNode node) {
            return fromTreeNode(node);
        }
        if (value instanceof Character c) {
            return String.valueOf(c);
        }
        if (value instanceof Double || value instanceof Float) {
            double d = ((Number) value).doubleValue();
            if (Double.isNaN(d) || Double.isInfinite(d)) {
                throw new IllegalStateException(
                        "the result is " + d + ", which has no JSON representation");
            }
            return d;
        }
        if (value instanceof Number || value instanceof Boolean || value instanceof String) {
            return value;
        }
        if (value instanceof List<?> list) {
            List<Object> out = new ArrayList<>(list.size());
            for (Object item : list) {
                out.add(toJson(item));
            }
            return out;
        }
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> out = new LinkedHashMap<>();
            for (Map.Entry<?, ?> e : map.entrySet()) {
                out.put(String.valueOf(e.getKey()), toJson(e.getValue()));
            }
            return out;
        }
        if (value.getClass().isArray()) {
            int n = java.lang.reflect.Array.getLength(value);
            List<Object> out = new ArrayList<>(n);
            for (int i = 0; i < n; i++) {
                out.add(toJson(java.lang.reflect.Array.get(value, i)));
            }
            return out;
        }
        throw new IllegalStateException(
                "cannot serialise a value of type " + value.getClass().getName()
                        + "; see docs/PROBLEM_FORMAT.md");
    }
}

/** A JSON reader and writer with no dependencies, sufficient for the wire format. */
final class DevProMaxJson {

    private final String text;
    private int at;

    private DevProMaxJson(String text) {
        this.text = text;
    }

    static Object parse(String text) {
        DevProMaxJson parser = new DevProMaxJson(text);
        parser.skipWhitespace();
        Object value = parser.readValue();
        parser.skipWhitespace();
        return value;
    }

    private void skipWhitespace() {
        while (at < text.length() && Character.isWhitespace(text.charAt(at))) {
            at++;
        }
    }

    private Object readValue() {
        char c = text.charAt(at);
        switch (c) {
            case '{':
                return readObject();
            case '[':
                return readArray();
            case '"':
                return readString();
            case 't':
                at += 4;
                return Boolean.TRUE;
            case 'f':
                at += 5;
                return Boolean.FALSE;
            case 'n':
                at += 4;
                return null;
            default:
                return readNumber();
        }
    }

    private Map<String, Object> readObject() {
        Map<String, Object> out = new LinkedHashMap<>();
        at++; // '{'
        skipWhitespace();
        if (text.charAt(at) == '}') {
            at++;
            return out;
        }
        while (true) {
            skipWhitespace();
            String key = readString();
            skipWhitespace();
            at++; // ':'
            skipWhitespace();
            out.put(key, readValue());
            skipWhitespace();
            char c = text.charAt(at++);
            if (c == '}') {
                return out;
            }
        }
    }

    private List<Object> readArray() {
        List<Object> out = new ArrayList<>();
        at++; // '['
        skipWhitespace();
        if (text.charAt(at) == ']') {
            at++;
            return out;
        }
        while (true) {
            skipWhitespace();
            out.add(readValue());
            skipWhitespace();
            char c = text.charAt(at++);
            if (c == ']') {
                return out;
            }
        }
    }

    private String readString() {
        StringBuilder out = new StringBuilder();
        at++; // opening quote
        while (true) {
            char c = text.charAt(at++);
            if (c == '"') {
                return out.toString();
            }
            if (c != '\\') {
                out.append(c);
                continue;
            }
            char escape = text.charAt(at++);
            switch (escape) {
                case 'n' -> out.append('\n');
                case 't' -> out.append('\t');
                case 'r' -> out.append('\r');
                case 'b' -> out.append('\b');
                case 'f' -> out.append('\f');
                case 'u' -> {
                    out.append((char) Integer.parseInt(text.substring(at, at + 4), 16));
                    at += 4;
                }
                default -> out.append(escape);
            }
        }
    }

    /**
     * Integers come back as Long and everything else as Double, so that an
     * `int` test input survives the round trip without picking up a spurious
     * `.0` on the way out.
     */
    private Object readNumber() {
        int start = at;
        boolean floating = false;
        while (at < text.length()) {
            char c = text.charAt(at);
            if (c == '-' || c == '+' || (c >= '0' && c <= '9')) {
                at++;
            } else if (c == '.' || c == 'e' || c == 'E') {
                floating = true;
                at++;
            } else {
                break;
            }
        }
        String token = text.substring(start, at);
        return floating ? (Object) Double.parseDouble(token) : (Object) Long.parseLong(token);
    }

    // --- writing ----------------------------------------------------------

    static String write(Object value) {
        StringBuilder out = new StringBuilder();
        writeInto(out, value);
        return out.toString();
    }

    private static void writeInto(StringBuilder out, Object value) {
        if (value == null) {
            out.append("null");
            return;
        }
        if (value instanceof String s) {
            writeString(out, s);
            return;
        }
        if (value instanceof Boolean b) {
            out.append(b.booleanValue() ? "true" : "false");
            return;
        }
        if (value instanceof Double || value instanceof Float) {
            double d = ((Number) value).doubleValue();
            if (Double.isNaN(d) || Double.isInfinite(d)) {
                throw new IllegalStateException(d + " has no JSON representation");
            }
            if (d == Math.rint(d) && Math.abs(d) < 1e15) {
                // 2.0 and 2 are the same JSON number; emit the shorter form so a
                // double-returning solution still matches an integer expectation.
                out.append((long) d);
            } else {
                out.append(d);
            }
            return;
        }
        if (value instanceof Number n) {
            out.append(n.toString());
            return;
        }
        if (value instanceof List<?> list) {
            out.append('[');
            for (int i = 0; i < list.size(); i++) {
                if (i > 0) {
                    out.append(',');
                }
                writeInto(out, list.get(i));
            }
            out.append(']');
            return;
        }
        if (value instanceof Map<?, ?> map) {
            out.append('{');
            boolean first = true;
            for (Map.Entry<?, ?> e : map.entrySet()) {
                if (!first) {
                    out.append(',');
                }
                first = false;
                writeString(out, String.valueOf(e.getKey()));
                out.append(':');
                writeInto(out, e.getValue());
            }
            out.append('}');
            return;
        }
        throw new IllegalStateException("cannot serialise " + value.getClass().getName());
    }

    private static void writeString(StringBuilder out, String value) {
        out.append('"');
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '"' -> out.append("\\\"");
                case '\\' -> out.append("\\\\");
                case '\n' -> out.append("\\n");
                case '\r' -> out.append("\\r");
                case '\t' -> out.append("\\t");
                case '\b' -> out.append("\\b");
                case '\f' -> out.append("\\f");
                default -> {
                    if (c < 0x20 || isLoneSurrogate(value, i)) {
                        // A lone surrogate is legal in a Java String and has no
                        // UTF-8 encoding, so the results writer threw on it and
                        // the whole run ended with no record (ROADMAP P2-19).
                        // JSON's escape carries it through intact.
                        out.append(String.format("\\u%04x", (int) c));
                    } else {
                        out.append(c);
                    }
                }
            }
        }
        out.append('"');
    }

    /** A surrogate that is not half of a well-formed pair. */
    private static boolean isLoneSurrogate(String value, int i) {
        char c = value.charAt(i);
        if (Character.isHighSurrogate(c)) {
            return i + 1 >= value.length() || !Character.isLowSurrogate(value.charAt(i + 1));
        }
        if (Character.isLowSurrogate(c)) {
            return i == 0 || !Character.isHighSurrogate(value.charAt(i - 1));
        }
        return false;
    }
}
