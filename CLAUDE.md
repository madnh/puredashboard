# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

PureDashboard is a **vanilla, zero-dependency, no-build, CSP-safe** UI module library
for embedded admin dashboards. The defining constraint shapes everything: **the files in
`src/` are shipped to the browser as-is** — there is no npm install, no bundler, no
transpile, no minify. It's designed to be embedded into a backend binary (e.g. Go
`//go:embed`). Read `README.md` and `docs/ARCHITECTURE.md` before non-trivial work.

## Commands

There is **no build, lint, or install step** (that's the point — keep it that way).

Tests are jsdom suites that run **only inside a throwaway Docker image**, so the host and
runtime stay zero-dependency:

```sh
make -C test            # build the image + run every test/*.test.mjs (each its own process)
```

Run a **single** suite (build the image once, then target one file):

```sh
docker build -q -t puredashboard-web-test test
docker run --rm -v "$(pwd):/work/web:ro" puredashboard-web-test \
  sh -c 'node /work/web/test/reactive.test.mjs'
```

Visual / real-browser checks (ES modules require HTTP, not `file://`):

```sh
python3 -m http.server 8731      # from repo root, then open in a browser:
# http://localhost:8731/test/showcase.html?shot=hero&theme=dark&lang=en
# (showcase.html params: shot=hero|table|upload|markdown|menu|toast|dialog, theme=light|dark, lang=en|vi)
# also: test/*-harness.html, test/demo.html, test/focus.html
```

## Architecture (the parts that need multiple files to grasp)

**Two `html` tagged templates coexist on purpose** — picking the wrong one is the most
common mistake:
- `reactive.js` `html` — a lit-html-style **parts engine that diffs the DOM in place**,
  so `<input>` focus/caret/scroll survive re-renders. **Any custom element that takes
  input MUST use this one.** Use `repeat(items, keyFn, tmplFn)` for keyed lists.
- `html.js` `html` — a one-shot **string→innerHTML** builder (auto-escaping; `raw()` for
  trusted markup). Used for static fragments, notably inline SVG icons.

**Three component families, each matched to its job** (don't force everything into a base):
1. **Reactive custom elements** (`table.js`, `upload.js`) — `extends Reactive`; declare
   state in `static properties`, return `reactive.js` `html` from `render()`.
2. **Imperative overlays** (`dialog.js`, `menu.js`, `toast.js`) — plain functions, *not*
   components. They build DOM, show it on the native top layer (`<dialog>`/Popover), and
   return a controller + Promise. You invoke-and-await them.
3. **Pure-DOM element** (`md.js`, `<puredashboard-markdown>`) — `extends HTMLElement`
   (not `Reactive`); builds nodes with `createElement` + `textContent` ONLY. This is the
   XSS-safety guarantee for untrusted input — never route it through `innerHTML`/`html`.

`router.js` and `md.js` are standalone. `md.js` has two layers: a pure testable
`parseMarkdown` (AST + href whitelist) and `renderMarkdown` (DocumentFragment, textContent-only).

## Invariants to preserve when editing (these are load-bearing)

- **No new runtime dependency, no build step, no `eval`/`new Function`.** The engine
  clones `<template>` + walks markers; it must keep running under `script-src 'self'`.
  Inline `style="…"` is allowed only for *dynamic* values (needs `style-src 'unsafe-inline'`).
- **BEM class names, block = the component tag** (`.puredashboard-table__row--selected`).
  Anything the script selects is a SEPARATE `js-…` class or `data-*` attr — never style those.
- **All user-facing strings live in a `LABELS` map**, overridable via one `labels`
  property (function-valued keys interpolate). No parallel `label`/`text` props.
- **Per-component CSS is self-contained**, themed through a `--pd-x ← --app-token ←
  system-color` fallback chain. `src/theme/` (tokens/base/shell/dashboard) is the
  OPTIONAL app-level theme that supplies those tokens; components must work without it.
- Each component **inlines its own SVG** via a local `svg()` helper — no shared icon module.
- Full design rules + the add-a-component recipe: `docs/DEVELOPMENT.md`.

### Test gotcha
The parts engine preserves whitespace exactly (like lit-html). When a test asserts
`textContent` with an exact `===`, keep the template's inner text on **one line** — a
multi-line `html\`<el>\n  text\n</el>\`` puts newlines into `textContent` and fails.

## Repo / distribution conventions

- **Only `src/` ships.** `test/` and `docs/` are dev-only; when embedding (e.g. Go
  `//go:embed`), keep them out — names starting with `_` or `.` are skipped by the embed
  walker. See `docs/USAGE.md`.
- **Not published to any registry** (no npm package — by design). Distributed as source +
  GitHub Releases. Version via git tags + `CHANGELOG.md` (currently `v0.1.0`, `0.x` = API may change).
- **Pull requests are not accepted** (issues-only; see `CONTRIBUTING.md`). When proposing
  changes, don't add CI/workflow files — a CI pipeline contradicts the no-build story.
