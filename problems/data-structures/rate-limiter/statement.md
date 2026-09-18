A service allows at most `limit` requests in any stretch of `window` ticks.

A request arriving at tick `t` is allowed when fewer than `limit` requests have
**already been allowed** at ticks strictly after `t - window`. A refused request
does not count against anything.

Requests arrive in non-decreasing order of time.

## Operations

- `RateLimiter(limit, window)` — a limiter with that allowance
- `allow(at)` — whether the request arriving at tick `at` is allowed

## Input

- Construction takes two integers.
- `allow` takes one integer.

## Output

- `allow` returns a boolean.

## Constraints

- `1 <= limit <= 1000`
- `1 <= window <= 10^6`
- `1 <= at <= 10^9`, and the times passed to `allow` never decrease.
- At most 10^4 calls to `allow`.

## Examples

### Example 1

`RateLimiter(2, 10)`, `allow(1)` → `true`, `allow(2)` → `true`, `allow(3)` →
`false`, `allow(12)` → `true`

The first two are allowed; the third is refused because both are still inside
the window. By tick 12 the request from tick 1 has aged out.

### Example 2

`RateLimiter(1, 5)`, `allow(1)` → `true`, `allow(6)` → `true`

Tick 6 is more than five ticks after tick 1, so the first has aged out.

### Example 3

`RateLimiter(1, 5)`, `allow(1)` → `true`, `allow(1)` → `false`

Two requests at the same tick, and only one is allowed.
