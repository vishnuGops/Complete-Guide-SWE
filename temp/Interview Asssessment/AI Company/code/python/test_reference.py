"""Same suite, run against reference_solution.py. Proves the tests are sane.

    python -m unittest test_reference -v
"""

import unittest

import _cases
from reference_solution import Solution


class TestRefLevel1(_cases.Level1Cases, unittest.TestCase):
    SOLUTION = Solution


class TestRefLevel2(_cases.Level2Cases, unittest.TestCase):
    SOLUTION = Solution


class TestRefLevel3(_cases.Level3Cases, unittest.TestCase):
    SOLUTION = Solution


class TestRefLevel4(_cases.Level4Cases, unittest.TestCase):
    SOLUTION = Solution


if __name__ == "__main__":
    unittest.main(verbosity=2)
