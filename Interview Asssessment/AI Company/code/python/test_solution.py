"""Runs the suite against YOUR solution.py.

    python -m unittest -v                          # everything
    python -m unittest test_solution -v            # your solution only
    python -m unittest test_solution.TestLevel1 -v # one level
    python -m unittest test_solution.TestLevel1.test_add_new_file_returns_true

If you install pytest (`pip install pytest`), `pytest -q` works too.
"""

import unittest

import _cases
from solution import Solution


class TestLevel1(_cases.Level1Cases, unittest.TestCase):
    SOLUTION = Solution


class TestLevel2(_cases.Level2Cases, unittest.TestCase):
    SOLUTION = Solution


class TestLevel3(_cases.Level3Cases, unittest.TestCase):
    SOLUTION = Solution


class TestLevel4(_cases.Level4Cases, unittest.TestCase):
    SOLUTION = Solution


if __name__ == "__main__":
    unittest.main(verbosity=2)
