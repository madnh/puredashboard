# Architecture

How PureDashboard is built, and *why* it's built this way. Read this before adding or
changing a component — it explains the load-bearing decisions the rest of the code
relies on.

The whole library is **~2,200 lines of plain ES modules** under `src/`. No runtime
dependency, no build step, no `eval`/`new Function`. Everything below is achievable
because the browser already ships the hard parts (the HTML parser, the top layer,
native `<dialog>`, the Popover API, History API) — the code mostly *orchestrates*
native platform features instead of re-implementing them.

---

## 1. The big picture

```
                       ┌──────────────────────────────────────────┐
                       │  Templating layer (two tags, on purpose)  │
                       │                                           │
   reactive.js  html`` │  parts engine — diffs the DOM IN PLACE    │
   html.js      html`` │  string builder — one-shot innerHTML      │
                       └──────────────────────────────────────────┘
                                        │ used by
            ┌───────────────────────────┼────────────────────────────┐
            ▼                           ▼                            ▼
  ┌───────────────────┐      ┌────────────────────┐      ┌────────────────────┐
  │ Reactive elements │      │ Imperative overlays│      │ Pure-DOM element   │
  │ extends Reactive  │      │ plain functions    │      │ extends HTMLElement │
  │                   │      │                    │      │                    │
  │ <…-table>         │      │ dialog/drawer      │      │ <…-markdown>       │
  │ <…-upload>        │      │ menu, toast        │      │ (textContent-only) │
  └───────────────────┘      └────────────────────┘      └────────────────────┘

  Standalone:  Router (router.js) · md parser/renderer (md.js)
  Per-component CSS:  *.css — self-contained, themed through a --pd-* token chain
```

There is no central runtime, no registry, no app shell. Each module stands alone and
imports only its siblings via **relative** paths (`./reactive.js`, `./html.js`). Drop
the folder anywhere, name it anything — nothing hardcodes a path.

---

## 2. Templating: two `html` tags, deliberately

The single most important design choice. There are **two** tagged-template `html`
functions, and picking the right one is the difference between an `<input>` that keeps
its focus across a re-render and one that doesn't.

### 2a. `reactive.js` → a lit-html-style parts engine (in-place diffing)

This is the engine that powers the reactive custom elements. It never rebuilds a
subtree wholesale; it updates only the *parts* that changed, so live DOM state (focus,
caret, scroll position, an `<img>` that's mid-decode) survives a re-render.

The pipeline, all in `reactive.js`:

1. **`compile(strings)`** — walks the template's static string segments and splices a
   sentinel marker at each `${}` hole: a `<!--lit-->` comment for a *child* position,
   or the bare text `lit` inside an *attribute* value (it decides which by checking
   whether the last `<` is still unclosed). It sets `template.innerHTML` **once** and
   caches the result keyed by the `strings` array. Because a tagged template literal
   hands back the *same* `strings` array object on every call from the same source
   location, this cache is effectively a per-call-site compile-once.

2. **`instantiate(compiled)`** — clones the cached `<template>` and uses a
   `TreeWalker` to find the markers in source order, building a `Part` for each:
   - `NodePart` for a `<!--lit-->` comment (a child/text hole).
   - `AttrPart` for any attribute whose value contains the marker. The **first
     character of the attribute name** selects the binding kind:
     `@click`→event, `.value`→property, `?disabled`→boolean, anything else→attribute
     (which also supports static text + multiple holes concatenated, e.g.
     `class="row ${a} ${b}"`).
   - A safety check: if the number of discovered bindings ≠ the number of `${}` holes,
     it **throws** a clear error. This catches the one case the HTML parser silently
     breaks — a `${}` inside a raw-text element (`<textarea>`/`<title>`/`<script>`/
     `<style>`), whose marker is swallowed as literal text. Better a loud error than a
     render that silently shifts every later binding.

3. **`bindAll` / `setValue`** — pushes values into parts. Each part remembers its last
   value and is a no-op when unchanged. `NodePart.commit` is the interesting one; it
   handles, in order: a `repeat()` directive, a **nested** `html\`\`` result, `null`/
   boolean/empty (→ remove nodes), string/number (→ mutate the existing text node's
   `.data` in place if there is one, else create one), a DOM node, an array, or trusted
   raw markup. The nested-template case is what makes `${html\`…\`}` diff in place: if
   the child's `strings` array is identical to last time, the child instance is reused
   and only its parts update.

4. **`repeat(items, keyFn, tmplFn)`** — the keyed-list directive. `NodePart.commitRepeat`
   runs a **two-end reconciliation** (the Snabbdom/lit algorithm): it walks the old and
   new key lists from both ends, reusing rows by key — updating in place and *moving*
   the existing DOM nodes rather than rebuilding them. Only genuinely new keys build
   DOM; only dropped keys remove it. Each row is a `Row` with its own anchor comment so
   it can be relocated in one shot. Use this (not a bare `array.map()`) whenever rows
   hold focus or per-row state.

5. **`renderResult(result, container)`** — the mount/update entry point. First call
   clones and inserts and stashes the instance on `container.__lit`; later calls with
   the *same* template reuse the live DOM and update only changed parts. (A non-result
   value falls back to `innerHTML` for convenience.)

**Why this matters for CSP:** templates are turned into DOM by *cloning a
`<template>` and walking nodes* — never by compiling strings into code. There is no
`eval`, no `new Function`. It runs unmodified under a strict `script-src 'self'`.

### 2b. `html.js` → a string builder (one-shot, escaped)

A much smaller tag for when you just want a string to drop into `innerHTML` and don't
need in-place diffing. It **auto-escapes every interpolation** (the XSS footgun of
manual string concatenation is removed by default) and returns a `SafeString` (a
`Symbol`-marked object) so that nested `html\`\`` results and arrays of them are
inserted verbatim while plain values are escaped. `raw()` opts a trusted string out of
escaping; `icon()` and `escapeHTML()` round it out.

In practice the library uses this for **self-contained inline SVG icons**: each
component defines a tiny local `svg()` helper that wraps `raw()`, so an icon is just a
trusted markup string with no shared icon module or sprite dependency.

**Rule of thumb:** a custom element that takes input → `reactive.js` `html`. A static,
one-shot fragment (an icon, a label) → `html.js` `html`.

---

## 3. The `Reactive` base class

`class Reactive extends HTMLElement` (in `reactive.js`) is the ReactiveElement-style
base for the input-bearing custom elements. The lifecycle is intentionally tiny:

- **`static properties = { … }`** — for each declared name the constructor installs a
  getter/setter. Setting a property records the old value and schedules a re-render on
  a **microtask** (so a burst of property writes coalesces into one render).
- **`connectedCallback`** runs a one-time `setup?.()`, marks the element ready, and
  schedules the first render.
- **`render()`** returns a `reactive.js` `html\`\`` result; `#run` feeds it to
  `renderResult` (in-place diff against the element's own children) and then calls the
  optional `firstUpdated(changed)` / `updated(changed)` hooks.
- **Events:** `emit(name, detail)` dispatches a bubbling `CustomEvent`. `on(type, sel,
  fn)` registers **delegated** listeners — one listener per type on the host, so they
  survive re-renders — though inline `@event` bindings in the template are usually
  nicer. `$()`/`$$()` are `querySelector` shorthands.

That's the whole framework. No virtual DOM kept in JS, no diff of an old vtree — the
*live DOM* is the state, and the parts engine reconciles into it.

---

## 4. Three component families

Not everything should be a reactive component. The library deliberately uses three
shapes, each matched to its job:

| Family | Base | Members | Why |
|--------|------|---------|-----|
| **Reactive custom element** | `extends Reactive` | `<…-table>`, `<…-upload>` | Has a template that re-renders on state changes and contains inputs/scroll that must survive those re-renders. Needs the parts engine. |
| **Imperative overlay** | plain function | `dialog`/`drawer`/`alert`/`confirm`/`prompt`, `menu`, `toast` | You *invoke and await* it; there's nothing to re-render. Each builds a DOM node, shows it in the **top layer** (modal `<dialog>` or Popover API), and returns a controller + a `Promise` of the result. |
| **Pure-DOM element** | `extends HTMLElement` | `<…-markdown>` | Emits prebuilt DOM (`createElement` + `textContent`) for XSS-safety. It has no template and no parts to diff, so routing it through `Reactive` would gain nothing — and its non-`html` return value would hit the `innerHTML` fallback, defeating the textContent-only guarantee. |

### Overlays lean entirely on the native top layer

`dialog()` uses `<dialog>.showModal()`, which gives focus-trap, Esc-to-close, top-layer
stacking, and (with `closedby="any"`) backdrop light-dismiss **for free**; a small
fallback reproduces light-dismiss on browsers without `closedby`. `menu()` and
`toast()` use `popover` so they live in the top layer above page content and escape
`overflow:hidden` ancestors, with light-dismiss for free; both fall back to a fixed,
high-`z-index` element where the Popover API is missing. None of them attach **global**
`document`/`window` listeners that outlive the node — all listeners live on the overlay
element and are GC'd with it, so there is no library-side leak.

---

## 5. Router (`router.js`)

A standalone `class Router`, independent of everything else. Two modes:

- **`hash`** (default) — URLs like `#/nodes/web`. Needs no server config, works from
  any mount point or `file://` path — ideal for a UI embedded in a backend binary.
  Links are real `<a href="#/…">` anchors; the router only *reacts* to `hashchange` and
  never attaches click handlers, so ⌘-click / open-in-new-tab / copy-link keep working.
- **`history`** — clean URLs via the History API. The router intercepts *same-origin*
  `<a>` clicks (pushState) while letting modified clicks (⌘/Ctrl/Shift/middle),
  `target=_blank`, downloads and cross-origin links fall through to the browser. Needs
  a server catch-all rewrite and an optional `base` for sub-path mounts.

Patterns are static (`/nodes`), param (`/nodes/:name`), and a catch-all (`*`) for 404.
Each route lazy-loads its page via `load()` (typically `() => import("./pages/x.js")`),
imported once and cached. A page's default export is either a custom-element **tag
name** or a **mount function** `(outlet, ctx) => cleanup?`. Layouts and guards compose
on top.

---

## 6. Markdown (`md.js`) — safe by construction

For **untrusted** content (e.g. remote/AI-authored messages). Two layers:

1. **`parseMarkdown(src)` → a plain-object AST.** Pure, no DOM, fully unit-testable.
   All parsing and whitelisting decisions live here — notably link `href`s are
   whitelisted to `http`/`https`/`mailto`/relative; anything else stays plain text.
   The inline tokenizer uses a **sticky (`y`) regex** anchored at the scan index, so it
   visits each character once — no quadratic blow-up on adversarial input.
2. **`renderMarkdown(src)` → a `DocumentFragment`,** built only with `document.create*`
   and `node.textContent`. No HTML strings, no `innerHTML` anywhere.

The security model is *structural*: because every text value reaches the DOM via
`textContent` (never HTML parsing) and the only elements that exist are the ones the
renderer `createElement`s, there is **no HTML-injection surface at all** — escaping
correctness isn't even in the trust path. `<puredashboard-markdown>` wraps this with a
`.value` setter.

---

## 7. Styling & theming

Each component ships **one self-contained stylesheet** (`table.css`, `dialog.css`, …).
Conventions that keep them collision-free and overridable:

- **BEM, block = the component tag.** `.puredashboard-table__row--selected`,
  `.puredashboard-menu__item--danger`. Guarantees no clashes with app styles.
- **`js-` / `data-*` for script hooks.** Anything the script selects is a *separate*
  `js-…` class or `data-*` attribute, never a style class — so restyling can't break
  behaviour.
- **A `--pd-*` token chain for theming.** Each colour resolves
  `var(--pd-accent)` ← `var(--accent, …)` ← a neutral **system-colour** default
  (`Canvas`/`CanvasText`/`color-mix`). So a component looks right with **zero config**,
  adapts to light/dark automatically, **themes** when the app defines its tokens, and
  can be **overridden** directly via `--pd-*`. See [USAGE.md](USAGE.md#theming) for how
  to drive this as a consumer.

The only inline styles are `style="…"` for genuinely *dynamic* values (a progress-bar
width, an overlay's computed position). That's why the recommended CSP allows
`'unsafe-inline'` for **styles only** — never for scripts.

---

## 8. File map

| File | Role |
|------|------|
| `reactive.js` | Parts engine (`html`, `repeat`, `renderResult`) + `Reactive` base class. The core. |
| `html.js` | String-builder `html` (escaped) + `raw`/`icon`/`escapeHTML`. Used for inline SVG. |
| `table.js` | `<puredashboard-table>` — reactive element. |
| `upload.js` | `<puredashboard-upload>` + `uploadFile()` — reactive element. |
| `dialog.js` | `dialog`/`drawer`/`alert`/`confirm`/`prompt` — imperative overlays. |
| `menu.js` | `menu()` — imperative overlay. |
| `toast.js` | `toast` (+ `.success/.error/.warn/.info`) — imperative overlay. |
| `router.js` | `Router` — standalone SPA router. |
| `md.js` | `parseMarkdown`/`renderMarkdown` + `<puredashboard-markdown>` — safe markdown. |
| `*.css` | One self-contained stylesheet per component, themed via `--pd-*`. |
| `theme/` | **Optional** app-level theme: `tokens.css` (palette), `base.css` (form controls), `shell.css` (dashboard frame), `dashboard.css` (all-in-one). Components work without it; it just supplies the tokens they read + a cohesive layout. |

Public API for each module is documented as **JSDoc** on the class/function, using the
custom-elements-manifest tags (`@element`, `@prop`, `@fires`, `@method`, `@cssprop`,
`@example`) so editors and tooling parse it precisely.
