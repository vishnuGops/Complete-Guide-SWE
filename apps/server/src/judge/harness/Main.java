import java.io.ByteArrayOutputStream;
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
 * `java -cp <workspace> Main payload.json`.
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
public class Main {

    static final int EXIT_OK = 0;
    static final int EXIT_LOAD_FAILED = 2;
    static final int EXIT_TIMEOUT = 3;

    /** Per test, so one runaway println cannot exhaust the heap. */
    static final int OUTPUT_CAP = 16 * 1024;

    /** Matches runner.py's thread stack, so deep recursion behaves alike. */
    static final long STACK_BYTES = 64L * 1024 * 1024;

    private static Writer results;

    public static void main(String[] args) throws Exception {
        Map<String, Object> payload = (Map<String, Object>) Json.parse(
                Files.readString(Path.of(args[0]), StandardCharsets.UTF_8));

        results = Files.newBufferedWriter(
                Path.of((String) payload.get("resultsPath")), StandardCharsets.UTF_8);

        String mode = (String) payload.get("mode");
        String entry = (String) payload.get("entry");
        String expect = (String) payload.get("expect");
        long timeoutMs = ((Number) payload.get("timeoutMs")).longValue();
        List<Object> tests = (List<Object>) payload.get("tests");

        Class<?> target;
        String wanted = mode.equals("operations") ? entry : "Solution";
        try {
            target = Class.forName(wanted);
        } catch (ClassNotFoundException err) {
            writeFatal("load", "the compiled solution does not define " + wanted, "");
            System.exit(EXIT_LOAD_FAILED);
            return;
        }

        Method method = null;
        if (!mode.equals("operations")) {
            method = findMethod(target, entry, tests);
            if (method == null) {
                writeFatal("load", "Solution has no method named " + entry, "");
                System.exit(EXIT_LOAD_FAILED);
                return;
            }
        }

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
        System.exit(exit);
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

        ByteArrayOutputStream outBuffer = new ByteArrayOutputStream();
        ByteArrayOutputStream errBuffer = new ByteArrayOutputStream();
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
        worker.start();
        try {
            worker.join(timeoutMs);
        } catch (InterruptedException ignored) {
            Thread.currentThread().interrupt();
        }
        boolean timedOut = worker.isAlive();
        double elapsedMs = (System.nanoTime() - started) / 1_000_000.0;
        System.setOut(realOut);
        System.setErr(realErr);

        if (timedOut) {
            record.put("status", "timeout");
            record.put("timeMs", (double) timeoutMs);
            writeRecord(record);
            results.flush();
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
            error.put("type", err.getClass().getSimpleName());
            error.put("message", err.getMessage() == null ? "" : err.getMessage());
            error.put("traceback", stackTrace(err));
            record.put("error", error);
        } else {
            record.put("status", "ok");
            record.putAll((Map<String, Object>) outcome[0]);
        }

        record.put("timeMs", elapsedMs);
        String stdout = capture(outBuffer);
        String stderr = capture(errBuffer);
        record.put("stdout", stdout);
        record.put("stderr", stderr);
        if (outBuffer.size() > OUTPUT_CAP || errBuffer.size() > OUTPUT_CAP) {
            record.put("outputTruncated", true);
        }

        writeRecord(record);
        return true;
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
        for (int i = 0; i < types.length; i++) {
            args[i] = Convert.toJava(rawArgs.get(i), types[i]);
        }

        method.setAccessible(true);
        Object returned = method.invoke(instance, args);

        Map<String, Object> out = new LinkedHashMap<>();
        if (expect.equals("return") || expect.equals("both")) {
            out.put("returned", method.getReturnType() == void.class
                    ? null
                    : Convert.toJson(returned));
        }
        if (expect.equals("mutatedArgs") || expect.equals("both")) {
            List<Object> mutated = new ArrayList<>();
            for (int i = 0; i < args.length; i++) {
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("index", i);
                entry.put("value", Convert.toJson(args[i]));
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
            built[i] = Convert.toJava(ctorArgs.get(i), ctorTypes[i]);
        }
        Object instance = ctor.newInstance(built);

        List<Object> ops = (List<Object>) test.get("ops");
        List<Object> returns = new ArrayList<>();
        if (ops != null) {
            for (Object rawOp : ops) {
                Map<String, Object> op = (Map<String, Object>) rawOp;
                String name = (String) op.get("method");
                List<Object> opArgs = (List<Object>) op.get("args");
                if (opArgs == null) {
                    opArgs = List.of();
                }
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
                    args[i] = Convert.toJava(opArgs.get(i), types[i]);
                }
                Object returned = m.invoke(instance, args);
                returns.add(m.getReturnType() == void.class ? null : Convert.toJson(returned));
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

    private static String capture(ByteArrayOutputStream buffer) {
        byte[] bytes = buffer.toByteArray();
        int length = Math.min(bytes.length, OUTPUT_CAP);
        return new String(bytes, 0, length, StandardCharsets.UTF_8);
    }

    private static String stackTrace(Throwable err) {
        StringWriter writer = new StringWriter();
        err.printStackTrace(new PrintWriter(writer));
        String text = writer.toString();
        return text.length() > OUTPUT_CAP ? text.substring(0, OUTPUT_CAP) : text;
    }

    private static synchronized void writeRecord(Map<String, Object> record) throws IOException {
        results.write(Json.write(record));
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
final class Convert {

    private Convert() {
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
            return ((Number) require(value, "an integer")).intValue();
        }
        if (cls == long.class || cls == Long.class) {
            return ((Number) require(value, "an integer")).longValue();
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
                out[i] = ((Number) source.get(i)).intValue();
            }
            return out;
        }
        if (component == long.class) {
            long[] out = new long[n];
            for (int i = 0; i < n; i++) {
                out[i] = ((Number) source.get(i)).longValue();
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
                out[i] = ((String) source.get(i)).charAt(0);
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
        Deque<TreeNode> queue = new ArrayDeque<>();
        queue.add(root);
        while (!queue.isEmpty()) {
            TreeNode node = queue.poll();
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
final class Json {

    private final String text;
    private int at;

    private Json(String text) {
        this.text = text;
    }

    static Object parse(String text) {
        Json parser = new Json(text);
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
                    if (c < 0x20) {
                        out.append(String.format("\\u%04x", (int) c));
                    } else {
                        out.append(c);
                    }
                }
            }
        }
        out.append('"');
    }
}
