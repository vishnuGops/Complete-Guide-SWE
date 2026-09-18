"""DevProMax Python harness.

Invoked as `python -X utf8 -I runner.py payload.json`, with the user's solution
sitting next to it as `solution.py`.

Contract with the judge (apps/server/src/judge):

* Results are written to the path named in the payload as JSON Lines, one object
  per test, flushed after every line. The judge therefore still learns which
  tests passed even when the process is killed mid-run - which is exactly what
  makes the timeout isolation fallback possible.
* Nothing of consequence goes to stdout. The user's own `print` is captured per
  test and reported as data, so it can never corrupt the result stream.
* Exit codes: 0 every test attempted, 2 the solution could not be loaded,
  3 a per-test timeout fired and the remaining tests were abandoned.

Must run on Python 3.10 (see CLAUDE.md > Environment): no match statements on
structural patterns, no PEP 695 generics, no `itertools.batched`.
"""

import importlib.util
import io
import json
import os
import sys
import threading
import time
import traceback

EXIT_OK = 0
EXIT_LOAD_FAILED = 2
EXIT_TIMEOUT = 3

# Per test, so one runaway print cannot exhaust memory before the judge's own cap.
OUTPUT_CAP = 16 * 1024

RECURSION_LIMIT = 10_000
# Matches the JVM's -Xss64m, so a solution that recurses to the stated depth
# does not die differently in one language than the other.
STACK_BYTES = 64 * 1024 * 1024


class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next


class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right


# ---------------------------------------------------------------------------
# Wire format conversions
# ---------------------------------------------------------------------------


def to_list_node(values):
    if values is None:
        return None
    head = None
    for value in reversed(values):
        head = ListNode(value, head)
    return head


def from_list_node(node):
    out = []
    seen = set()
    while node is not None:
        if id(node) in seen:
            raise ValueError("the returned linked list contains a cycle")
        seen.add(id(node))
        out.append(node.val)
        node = node.next
    return out


def to_tree_node(values):
    if not values:
        return None
    root = TreeNode(values[0])
    queue = [root]
    i = 1
    while queue and i < len(values):
        node = queue.pop(0)
        if i < len(values):
            value = values[i]
            i += 1
            if value is not None:
                node.left = TreeNode(value)
                queue.append(node.left)
        if i < len(values):
            value = values[i]
            i += 1
            if value is not None:
                node.right = TreeNode(value)
                queue.append(node.right)
    return root


def from_tree_node(root):
    if root is None:
        return []
    out = []
    queue = [root]
    while queue:
        node = queue.pop(0)
        if node is None:
            out.append(None)
            continue
        out.append(node.val)
        queue.append(node.left)
        queue.append(node.right)
    while out and out[-1] is None:
        out.pop()
    return out


def render_annotation(annotation):
    """One parameter annotation as text, generics and all.

    The version this replaces used `getattr(annotation, "__name__", ...)`, which
    on the installed Python renders `Optional[ListNode]` as `"Union"` and
    `List[ListNode]` as `"List"` - so `decode_argument` saw no mention of
    `ListNode` and handed the solution the raw wire value. No catalogue problem
    hit it yet; every linked-list and tree starter in Batch B and C would
    (ROADMAP P2-12).

    Rendered rather than inspected structurally because half the annotations
    arrive as *strings*: a starter with `from __future__ import annotations`, or
    a quoted forward reference to a class defined below, gives text and nothing
    else. Text is the only form both cases share.
    """
    import typing

    if isinstance(annotation, str):
        return annotation

    args = typing.get_args(annotation)
    if not args:
        return getattr(annotation, "__name__", str(annotation))

    origin = typing.get_origin(annotation)
    base = getattr(origin, "__name__", None) or getattr(origin, "_name", None)
    if base is None:
        # `Optional[X]` and `X | None` both land here: their origin is
        # `typing.Union`, which has no usable name in every supported version.
        base = "Union"

    return "%s[%s]" % (base, ", ".join(render_annotation(arg) for arg in args))


def annotation_names(fn):
    """Parameter annotations as plain strings, in declaration order.

    Argument typing comes from the solution's own signature (ROADMAP D5) rather
    than from duplicated metadata, so the starter stays the single source of
    truth.
    """
    try:
        import inspect

        params = list(inspect.signature(fn).parameters.values())
    except (TypeError, ValueError):
        return []
    names = []
    for param in params:
        if param.name == "self":
            continue
        if param.annotation is inspect.Parameter.empty:
            names.append("")
        else:
            names.append(render_annotation(param.annotation))
    return names


def _strip_optional(text):
    """`Optional[X]` / `Union[X, None]` / `X | None` -> `X`.

    Only the None-ness is removed. A union of two real types is left alone,
    because there is no way to choose between them and guessing would decode
    silently wrong.
    """
    for prefix in ("Optional[", "Union["):
        if text.startswith(prefix) and text.endswith("]"):
            members = _split_args(text[len(prefix) : -1])
            members = [m for m in members if m not in ("None", "NoneType")]
            if len(members) == 1:
                return _strip_optional(members[0])
            return text

    if "|" in text:
        members = [m.strip() for m in text.split("|")]
        members = [m for m in members if m not in ("None", "NoneType")]
        if len(members) == 1:
            return _strip_optional(members[0])

    return text


def _split_args(text):
    """Splits `A, B[C, D]` on the top-level commas only."""
    parts = []
    depth = 0
    current = ""
    for char in text:
        if char == "[":
            depth += 1
        elif char == "]":
            depth -= 1
        if char == "," and depth == 0:
            parts.append(current.strip())
            current = ""
            continue
        current += char
    if current.strip():
        parts.append(current.strip())
    return parts


SEQUENCE_NAMES = ("List", "list", "Sequence", "Iterable", "Tuple", "tuple")


def _sequence_item(text):
    """The element annotation of a sequence type, or None if it is not one.

    Handles the Java spelling too (`ListNode[]`): the supported-type table in
    docs/PROBLEM_FORMAT.md lists it, and a Python starter written from that
    table would otherwise decode to a list of raw lists.
    """
    if text.endswith("[]"):
        return text[:-2].strip()

    for name in SEQUENCE_NAMES:
        prefix = name + "["
        if text.startswith(prefix) and text.endswith("]"):
            members = _split_args(text[len(prefix) : -1])
            # `Tuple[X, Y]` of mixed types is not something the table supports;
            # a homogeneous tuple is, and so is `Tuple[X, ...]`.
            members = [m for m in members if m != "..."]
            if len(members) == 1:
                return members[0]
            return None
    return None


def decode_argument(value, annotation):
    """Turns a wire value into what the signature says the solution wants.

    Only the two node types need this; everything else in the supported-type
    table is already what JSON gives us. Recursive, so `Optional[ListNode]`,
    `List[ListNode]` and `Optional[List[TreeNode]]` all decode - which is what
    P2-12 fixed.
    """
    if "ListNode" not in annotation and "TreeNode" not in annotation:
        return value

    text = _strip_optional(annotation.strip())

    item = _sequence_item(text)
    if item is not None:
        if not isinstance(value, list):
            return value
        return [decode_argument(entry, item) for entry in value]

    if value is None:
        return None
    if "ListNode" in text:
        return to_list_node(value)
    if "TreeNode" in text:
        return to_tree_node(value)
    return value


def encode_value(value):
    """Turn whatever the solution produced into something JSON can carry."""
    if isinstance(value, ListNode):
        return from_list_node(value)
    if isinstance(value, TreeNode):
        return from_tree_node(value)
    if isinstance(value, tuple):
        return [encode_value(v) for v in value]
    if isinstance(value, list):
        return [encode_value(v) for v in value]
    if isinstance(value, dict):
        return {str(k): encode_value(v) for k, v in value.items()}
    if isinstance(value, (set, frozenset)):
        raise TypeError(
            "a set has no order, so it cannot be compared; return a list instead"
        )
    if isinstance(value, bool) or value is None:
        return value
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        if value != value or value in (float("inf"), float("-inf")):
            raise ValueError(
                "the result is %r, which has no JSON representation" % (value,)
            )
        return value
    if isinstance(value, str):
        return value
    raise TypeError(
        "cannot serialise a value of type %s; see docs/PROBLEM_FORMAT.md"
        % type(value).__name__
    )


# ---------------------------------------------------------------------------
# Result stream
# ---------------------------------------------------------------------------


class Results:
    def __init__(self, path):
        self._file = open(path, "w", encoding="utf-8", newline="\n")
        self._lock = threading.Lock()

    def write(self, record):
        line = json.dumps(record, ensure_ascii=False, allow_nan=False)
        with self._lock:
            self._file.write(line + "\n")
            self._file.flush()
            os.fsync(self._file.fileno())

    @property
    def lock(self):
        return self._lock

    def write_locked(self, record):
        """Write without taking the lock; the caller already holds it."""
        line = json.dumps(record, ensure_ascii=False, allow_nan=False)
        self._file.write(line + "\n")
        self._file.flush()
        os.fsync(self._file.fileno())


def cap(text):
    if len(text) <= OUTPUT_CAP:
        return text, False
    return text[:OUTPUT_CAP], True


# ---------------------------------------------------------------------------
# Loading the solution
# ---------------------------------------------------------------------------


def load_solution(path):
    """Import the user's module with ListNode/TreeNode already in its globals.

    Setting the attributes on the module object before executing it is what lets
    a solution refer to `ListNode` without defining or importing it.
    """
    spec = importlib.util.spec_from_file_location("solution", path)
    module = importlib.util.module_from_spec(spec)
    module.ListNode = ListNode
    module.TreeNode = TreeNode
    sys.modules["solution"] = module
    spec.loader.exec_module(module)
    return module


def syntax_error_record(err):
    return {
        "event": "fatal",
        "kind": "compile",
        "message": err.msg or "syntax error",
        "line": err.lineno,
        "column": err.offset,
    }


# ---------------------------------------------------------------------------
# Running one test
# ---------------------------------------------------------------------------


def run_function_test(module, entry, expect, args):
    solution = module.Solution()
    method = getattr(solution, entry)
    annotations = annotation_names(method)
    decoded = [
        decode_argument(value, annotations[i] if i < len(annotations) else "")
        for i, value in enumerate(args)
    ]

    returned = method(*decoded)

    record = {}
    if expect in ("return", "both"):
        record["returned"] = encode_value(returned)
    if expect in ("mutatedArgs", "both"):
        record["mutatedArgs"] = [
            {"index": i, "value": encode_value(value)} for i, value in enumerate(decoded)
        ]
    return record


class OperationError(Exception):
    """A failure during one call of an operations sequence (ROADMAP P2-12).

    Carries which call it was. Without that, a design problem's twentieth
    `pop()` raising `IndexError` was reported as "IndexError" with no
    indication of which of twenty calls it came from, and the returns collected
    before it were discarded - so the user could not even count the successful
    ones.
    """

    def __init__(self, index, method, cause, returns):
        super().__init__("operation %d (%s) raised %s: %s" % (index, method, type(cause).__name__, cause))
        self.index = index
        self.method = method
        self.cause = cause
        self.returns = returns


def run_operations_test(module, entry, args, ops):
    cls = getattr(module, entry)
    instance = cls(*args)
    returns = []
    for index, op in enumerate(ops):
        method = getattr(instance, op["method"], None)
        if method is None:
            raise OperationError(
                index,
                op["method"],
                AttributeError("%s has no method named %r" % (entry, op["method"])),
                returns,
            )
        try:
            returns.append(encode_value(method(*op.get("args", []))))
        except Exception as error:  # noqa: BLE001 - reported, not handled
            raise OperationError(index, op["method"], error, returns) from error
    return {"returned": returns}


def run_tests(module, payload, results):
    entry = payload["entry"]
    mode = payload["mode"]
    expect = payload["expect"]
    timeout_ms = payload["timeoutMs"]

    state = {"index": None, "done": True}

    def on_timeout(index):
        with results.lock:
            if state["index"] != index or state["done"]:
                return
            results.write_locked(
                {"index": index, "status": "timeout", "timeMs": timeout_ms}
            )
        # The test is still running and cannot be interrupted safely, so hand the
        # remaining tests back to the judge, which re-runs them one per process.
        os._exit(EXIT_TIMEOUT)

    for test in payload["tests"]:
        index = test["index"]
        with results.lock:
            state["index"] = index
            state["done"] = False

        timer = threading.Timer(timeout_ms / 1000.0, on_timeout, args=(index,))
        timer.daemon = True
        timer.start()

        out_buffer = io.StringIO()
        err_buffer = io.StringIO()
        real_stdout, real_stderr = sys.stdout, sys.stderr
        sys.stdout, sys.stderr = out_buffer, err_buffer

        started = time.perf_counter()
        record = {"index": index}
        try:
            if mode == "operations":
                record.update(
                    run_operations_test(module, entry, test["args"], test.get("ops", []))
                )
            else:
                record.update(run_function_test(module, entry, expect, test["args"]))
            record["status"] = "ok"
        except OperationError as err:
            # Which call failed, and what the sequence produced up to it
            # (ROADMAP P2-12). A design problem is a sequence of calls; "it
            # raised IndexError" with no index is a needle in twenty haystacks.
            record["status"] = "error"
            record["returned"] = err.returns
            record["error"] = {
                "type": type(err.cause).__name__,
                "message": "operation %d (%s) raised %s: %s"
                % (err.index, err.method, type(err.cause).__name__, err.cause),
                "traceback": user_traceback(err.cause),
            }
        except BaseException as err:  # noqa: BLE001 - user code can raise anything
            record["status"] = "error"
            record["error"] = {
                "type": type(err).__name__,
                "message": str(err),
                "traceback": user_traceback(err),
            }
        finally:
            elapsed_ms = (time.perf_counter() - started) * 1000.0
            sys.stdout, sys.stderr = real_stdout, real_stderr
            timer.cancel()
            with results.lock:
                state["done"] = True

        record["timeMs"] = elapsed_ms
        stdout_text, stdout_cut = cap(out_buffer.getvalue())
        stderr_text, stderr_cut = cap(err_buffer.getvalue())
        record["stdout"] = stdout_text
        record["stderr"] = stderr_text
        if stdout_cut or stderr_cut:
            record["outputTruncated"] = True

        try:
            results.write(record)
        except ValueError as err:
            # encode_value already rejects non-finite floats; this is the backstop
            # for anything else json refuses, so the test fails rather than the run.
            results.write(
                {
                    "index": index,
                    "status": "error",
                    "timeMs": elapsed_ms,
                    "error": {
                        "type": "SerialisationError",
                        "message": str(err),
                        "traceback": "",
                    },
                }
            )


def user_traceback(err):
    """The traceback with the harness's own frames stripped off the top."""
    frames = traceback.extract_tb(err.__traceback__)
    kept = [f for f in frames if os.path.basename(f.filename) != "runner.py"]
    lines = traceback.format_list(kept or frames)
    lines.extend(traceback.format_exception_only(type(err), err))
    text, _ = cap("".join(lines))
    return text


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main():
    payload_path = sys.argv[1]
    with open(payload_path, "r", encoding="utf-8") as handle:
        payload = json.load(handle)

    results = Results(payload["resultsPath"])
    sys.setrecursionlimit(RECURSION_LIMIT)

    try:
        module = load_solution(payload["solutionPath"])
    except SyntaxError as err:
        results.write(syntax_error_record(err))
        sys.exit(EXIT_LOAD_FAILED)
    except BaseException as err:  # noqa: BLE001
        results.write(
            {
                "event": "fatal",
                "kind": "load",
                "message": "%s: %s" % (type(err).__name__, err),
                "traceback": user_traceback(err),
            }
        )
        sys.exit(EXIT_LOAD_FAILED)

    if payload["mode"] == "operations":
        missing = not hasattr(module, payload["entry"])
    else:
        missing = not hasattr(module, "Solution")
    if missing:
        wanted = payload["entry"] if payload["mode"] == "operations" else "Solution"
        results.write(
            {
                "event": "fatal",
                "kind": "load",
                "message": "solution.py does not define %s" % wanted,
                "traceback": "",
            }
        )
        sys.exit(EXIT_LOAD_FAILED)

    run_tests(module, payload, results)
    sys.exit(EXIT_OK)


def main_on_big_stack():
    """Run on a worker thread with a large stack.

    The recursion limit is raised to 10,000, which is far past what the default
    1 MB thread stack survives; without this a deeply recursive solution would
    take the whole process down with a hard crash instead of reporting a
    RecursionError the user can act on.
    """
    try:
        threading.stack_size(STACK_BYTES)
    except (ValueError, RuntimeError):
        pass

    box = {}

    def target():
        try:
            main()
        except SystemExit as err:
            box["code"] = err.code
        except BaseException:  # noqa: BLE001
            traceback.print_exc()
            box["code"] = EXIT_LOAD_FAILED

    thread = threading.Thread(target=target)
    thread.start()
    thread.join()
    sys.exit(box.get("code", EXIT_OK))


if __name__ == "__main__":
    main_on_big_stack()
