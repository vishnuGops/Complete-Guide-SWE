Model a browser's history for a single tab.

The tab starts on a home page. Visiting a page moves forward to it and **throws
away everything that was ahead** — the forward history is gone the moment you
follow a new link. Going back or forward moves along the history without
changing it, and stops at whichever end it reaches.

## Operations

- `BrowserHistory(homepage)` — start on `homepage`
- `visit(url)` — go to `url` from the current page, discarding the forward
  history
- `back(steps)` — move back up to `steps` pages, stopping at the oldest, and
  return the page now shown
- `forward(steps)` — move forward up to `steps` pages, stopping at the newest,
  and return the page now shown

## Input

- Construction takes one string, the home page.
- `visit` takes a string; `back` and `forward` take an integer.

## Output

- `visit` returns nothing.
- `back` and `forward` return the page now shown.

## Constraints

- `1 <= url.length <= 20`
- `1 <= steps <= 100`
- At most 2000 operations in total.

## Examples

### Example 1

`BrowserHistory("home")`, `visit("a")`, `visit("b")`, `back(1)` → `"a"`,
`forward(1)` → `"b"`

Ordinary back and forward.

### Example 2

`BrowserHistory("home")`, `visit("a")`, `back(1)` → `"home"`, `visit("b")`,
`forward(1)` → `"b"`

Visiting `b` from `home` discards `a`, so there is nothing ahead of `b` and
`forward` stays put.

### Example 3

`BrowserHistory("home")`, `back(10)` → `"home"`

Going back further than the history allows stops at the oldest page.
