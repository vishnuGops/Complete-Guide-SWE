import random


def _chain(rng, length):
    """Values for a chain of `length` nodes, with repeats allowed.

    Repeats are the point: a solution that remembers *values* rather than nodes
    passes on distinct data and fails here, which is the mistake this problem is
    for.
    """
    return [rng.randint(-1000, 1000) for _ in range(length)]


def generate(rng: random.Random):
    # The four shapes that matter, then random ones around them.
    yield {"args": [[], -1]}
    yield {"args": [[5], -1]}
    yield {"args": [[5], 0]}
    yield {"args": [[1, 2], 0]}
    yield {"args": [[1, 2], 1]}
    yield {"args": [[3, 2, 0, -4], 1]}

    # Repeated values in an open chain: the case a set of values gets wrong.
    yield {"args": [[4, 4, 4, 4], -1]}
    yield {"args": [[4, 4, 4, 4], 2]}

    for _ in range(10):
        length = rng.randint(2, 60)
        values = _chain(rng, length)
        # Half looping, and the entry spread across the whole chain so the
        # run-up is sometimes nothing and sometimes almost everything.
        at = rng.randint(0, length - 1) if rng.random() < 0.5 else -1
        yield {"args": [values, at]}

    # The largest size the constraints allow, once open and once closed at the
    # very start - the longest possible run round the loop.
    biggest = _chain(rng, 10000)
    yield {"args": [biggest, -1]}
    yield {"args": [biggest, 0]}
