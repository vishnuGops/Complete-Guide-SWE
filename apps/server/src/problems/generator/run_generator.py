"""Runs a problem's generator.py and writes the cases it yields (ROADMAP P2-9).

Usage: run_generator.py <generator.py> <seed> <limit> <out.jsonl>

One JSON object per line in the output file, never on stdout. The reason is the
same one the judge harness has: an author debugging a generator adds a `print`,
and a protocol that shares a channel with `print` is a protocol that breaks the
moment someone does the obvious thing.

The generator is handed a seeded `random.Random` rather than being allowed to
use the `random` module's global state, so a regeneration with the same seed
produces the same tests and a diff shows real changes only.
"""

import importlib.util
import json
import random
import sys
import traceback


def fail(message):
    sys.stderr.write(message + "\n")
    sys.exit(1)


def load(path):
    spec = importlib.util.spec_from_file_location("devpromax_generator", path)
    if spec is None or spec.loader is None:
        fail("could not load %s as a Python module" % path)
    module = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(module)
    except Exception:
        fail("generator.py raised while being imported:\n%s" % traceback.format_exc())
    return module


def main():
    if len(sys.argv) != 5:
        fail("usage: run_generator.py <generator.py> <seed> <limit> <out.jsonl>")

    path, seed, limit, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
    module = load(path)

    generate = getattr(module, "generate", None)
    if generate is None or not callable(generate):
        fail("generator.py must define generate(rng) and yield one case per input")

    rng = random.Random(seed)
    written = 0
    with open(out, "w", encoding="utf-8") as handle:
        try:
            for case in generate(rng):
                if written >= limit:
                    break
                if not isinstance(case, dict):
                    fail("case %d is %s; every case must be a dict" % (written, type(case).__name__))
                handle.write(json.dumps(case, sort_keys=True) + "\n")
                written += 1
        except Exception:
            fail("generator.py raised on case %d:\n%s" % (written, traceback.format_exc()))

    if written == 0:
        fail("generate(rng) yielded nothing")


main()
