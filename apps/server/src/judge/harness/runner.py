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


def annotation_names(fn):
    """Parameter annotations as plain strings, in declaration order.

    Argument typing comes from the solution's own signature (ROADMAP D5) rather
    than from duplicated metadata, so the starter stays the single source of
    truth. Annotations may already be strings under
    `from __future__ import annotations`, so both forms are handled.
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
        annotation = param.annotation
        if annotation is inspect.Parameter.empty:
            names.append("")
        elif isinstance(annotation, str):
            names.append(annotation)
        else:
            names.append(getattr(annotation, "__name__", str(annotation)))
    return names


def decode_argument(value, annotation):
    if "ListNode" in annotation:
        return to_list_node(value)
    if "TreeNode" in annotation:
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


def run_operations_test(module, entry, args, ops):
    cls = getattr(module, entry)
    instance = cls(*args)
    returns = []
    for op in ops:
        method = getattr(instance, op["method"], None)
        if method is None:
            raise AttributeError(
                "%s has no method named %r" % (entry, op["method"])
            )
        returns.append(encode_value(method(*op.get("args", []))))
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
