# Changelog

All notable changes to PureDashboard are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Versions map to git tags / GitHub Releases (e.g. `v0.1.0`). While the version is `0.x`,
the API may still change between minor versions.

## [Unreleased]

### Added
- **`<puredashboard-copy>`** (`copy.js`): a copy-to-clipboard button — one click writes a
  value to the system clipboard and the button reports the result (the Lucide `copy`
  icon swaps to a check, or a cross on failure, for `feedback` ms, while an off-screen
  live region announces it). The value does not have to be text: a **string**, rich
  **HTML** (`type="html"` writes `text/html` *and* a plain-text flattening), or an
  **image** — a URL, a `Blob`/`File`, an `<img>` or a `<canvas>`, normalised to PNG
  through a canvas because that is the one format clipboards reliably accept. The value
  comes from `value` (also a possibly-async **function**, so it stays late-bound), `src`
  (an image URL, fetched on click) or `from` (a CSS selector — an `<input>` contributes
  its `.value`, anything else its `textContent`). Text degrades to the legacy
  `<textarea>` + `execCommand` path when the async Clipboard API is unavailable; images
  and HTML need a secure context, and a failure is never silent — it shows the error
  state and emits `copyerror`. Renders a real `<button>` (platform keyboard, focus,
  `disabled`) that is **named "Copy" by default**, so an icon-only one needs no
  `aria-label`. `variant="text"`, three sizes and the `--pd-copy-*` knobs match
  `<puredashboard-toggle>`, so they line up in one toolbar. The success event is
  **`copied`**, not `copy`, so it can't be confused with the platform's own bubbling
  Ctrl+C event.
  **Tables paste into a spreadsheet as real cells:** an element source contributes its
  `outerHTML` (so `from="#report table"` copies the grid, not a run-on string), a
  `<table>` is inferred as `html` without setting `type`, and the `text/plain` half is a
  structured flattening — **TSV** for tables (tab per cell, newline per row), line breaks
  for block elements and `<br>` — so Excel's "Paste Special → Text" and any plain-text
  field still get one cell per column instead of everything in one.
- **`<puredashboard-lazy>`** (`lazy.js`): defers building expensive content until it is
  needed — `<img loading="lazy">`, but for components. A page holding dozens of
  `<puredashboard-json-view>` / `<puredashboard-markdown>` / tables pays for all of them
  up front; wrapping each one defers the work until it scrolls into view. Measured in
  Chromium with 200 `<puredashboard-json-view>`s: **1005 ms → 53 ms** to build,
  **13 000 → 656** DOM nodes, **200 → 4** components upgraded.
  Three content sources: a **`<template>` child** (zero JS — a template's content is
  inert, so the elements inside are never even upgraded), a `render(host)` function, or
  `load: () => import(…)` whose default export is a tag name or a mount function (the
  same contract as a `router.js` page). Triggers: `visible` (default,
  `IntersectionObserver` + `rootMargin`), `idle`, `eager`, `manual` + `renderNow()`.
  While pending it shows the author's `[data-lazy-fallback]` child or a built-in shimmer
  of the reserved `height`, so nothing jumps on swap; `unrender` also tears content down
  when it scrolls far away (long lists). State is reflected as `data-state`
  (`pending`/`rendering`/`rendered`/`error`), it emits `render` / `unrender` /
  `loaderror`, materialises everything pending on `beforeprint`, and renders immediately
  where `IntersectionObserver` is unavailable so content is never lost.
- **`<puredashboard-toggle-group>`** (`toggle-group.js`): a set of `<puredashboard-toggle>`
  buttons sharing one selection — text alignment, a view mode, a formatting set. The
  toggles are the host's real light-DOM children (adopted like `splitter.js`'s panels,
  and re-synced live by a `MutationObserver` when they are added or removed), so any
  toggle feature — icons, labels, sizes, `variant` — works inside a group. Single-select
  by default (`value` is a string, `null` when empty); `multiple` makes it an array.
  `deselectable=false` keeps one always selected, `attached` (default) joins the buttons
  into one control, `orientation="vertical"` stacks them, `disabled` disables the set
  (and restores only what it disabled). Renders `role="group"` with a **roving tabindex**
  — the whole group is ONE tab stop and Arrow/Home/End move between the toggles
  (`loop` wraps). The children's own `change` events are swallowed; the group emits a
  single `change` `{value}`, so a caller listens in one place.
- **`<puredashboard-toggle>`** (`toggle.js`): a two-state button — it stays visibly
  pressed until pressed again — for a setting that applies IMMEDIATELY (bold/italic in a
  toolbar, mute, pin, "show archived"). Renders a native `<button>` with `aria-pressed`,
  so keyboard (Space/Enter), focus and `disabled` come from the platform. Deliberately
  **not** form-associated: `<puredashboard-switch>` (role=switch) and
  `<puredashboard-checkbox>` remain the form inputs — a toggle is an action button and
  submits nothing. Props: `pressed`, `disabled`, `value` (its identity inside a toggle
  group), `label` (string or node), `icon` (trusted SVG), `size`, `variant`
  (`default`/`text` for toolbars), plus `tabbable` + `focus()` so a group can run a
  roving tabindex. Emits `change` `{pressed, value}` on user action only — setting
  `.pressed` in JS stays silent. `pressed` is reflected as an attribute; an icon-only
  toggle takes its name from `aria-label` (mirrored onto the inner button).
- **`<puredashboard-meter>`** (`meter.js`): a gauge for a MEASUREMENT inside a known
  range (disk used, memory, quota, a score) — `role="meter"` with
  `aria-valuenow`/`min`/`max` + `aria-valuetext`, distinct from
  `<puredashboard-progress>`'s `role="progressbar"` (a meter reading moves either way and
  is never "done"; screen readers announce the two differently). Optional label row
  (label left, reading right), `showValue`, and `format` (`Intl.NumberFormat` options,
  applied to the raw value) + `locale` — so a meter can read "8.5 GB", "1.2K" or a
  currency instead of a percent. Setting `low`/`high`/`optimum` turns on the **native
  `<meter>` element's colour zones**: green in the optimum region, amber when
  suboptimal, red in the region furthest from `optimum` (including the spec's rule that
  an optimum in the middle band makes *both* ends merely suboptimal). Sizes `sm`/`md`/`lg`;
  the fill width rides a dynamic `--pd-meter-pct` custom property, so it stays CSP-safe.
- **`<puredashboard-menubar>`** (`menubar.js`): a desktop-style application menu bar
  (File · Edit · View …). The bar is the only custom element — each dropdown is opened by
  `menu()`, so items get icons in a reserved gutter, shortcut hints, separators, groups,
  checkbox / radio items and nested submenus for free. Implements the WAI-ARIA APG
  "Menubar" pattern: `role=menubar` + `role=menuitem` triggers with
  `aria-haspopup`/`aria-expanded`, roving tabindex, Arrow/Home/End along the bar,
  click-to-toggle, hover-to-switch once a menu is open, and ArrowLeft/ArrowRight to walk
  to the neighbouring menu (via `menu()`'s new `onEdgeNav` hook). `orientation="vertical"`
  turns it into a vertical bar (menus open beside it, titles reserve the icon slot so
  they line up). Emits `select` `{value,menu,index}` and `openchange` `{open,index}`;
  `open(i)`/`close()`/`openIndex` drive it programmatically.
- **`menu()`** (`menu.js`) grew the parts a real application menu needs, matching the
  Base UI Menu surface: **labelled groups** (`{ group, items }`), **checkbox items**
  (`{ checked }` → `role=menuitemcheckbox`), **radio groups**
  (`{ group, radio: value, onSelect }` → `role=menuitemradio`), **nested submenus**
  (`{ label, items }`, hover- or keyboard-opened), **keyboard-shortcut hints**
  (`shortcut`), and `closeOnSelect` per item (checkable items keep the menu open).
  Icons now sit in a **reserved gutter**: a menu with any icon (or any checkable item)
  reserves that slot on every item, so labels line up whether or not an item has one.
  Full APG keyboard map — arrows, Home/End, typeahead, ArrowRight/ArrowLeft, Enter/Esc
  per level — plus `aria-haspopup`/`aria-expanded` on the trigger and focus restore on
  close. Submenus are nested popovers (a submenu is a DOM child of its parent popup), so
  light-dismiss peels one level at a time. The returned promise now also carries
  `.close(value?)` and `.el` so a caller can drive the open menu.
- **`<puredashboard-json-view>`** (`json-view.js`): a collapsible, syntax-highlighted JSON
  tree. Takes any JS value or a JSON string (invalid JSON falls back to raw text). Colour
  mode is light/dark aware — `theme="auto"` follows the OS live — with **10 built-in
  palettes** (`light`, `dark`, `github-light`/`-dark`, `monokai`, `dracula`,
  `solarized-light`/`-dark`, `nord`, `one-dark`) plus custom per-mode palettes via the
  `themes` prop. `level` sets the initial expand depth (`0` = all collapsed incl. root,
  `1` = the root's fields, …) without locking the user's own toggles. Each leaf value has
  a copy button that reads `textContent` on click and keeps escapes (no raw newline / ANSI
  reaches the clipboard → paste-injection safe). XSS-safe: keys/values render as escaped
  text nodes.

### Security
- **Engine URL-scheme guard** (`reactive.js`): attribute bindings for URL attrs
  (`href`/`src`/`formaction`/…) now drop `javascript:`/`vbscript:` (and `data:` on
  navigational attrs), so a URL bound from a data field can't become click-to-XSS.
  `menu()` applies the same guard to item `href`.
- **Template type-confusion guard** (`reactive.js`): child/array bindings only render an
  object as markup when it carries the shared SAFE marker (html.js `raw()`/`html`);
  any other object is coerced to text instead of `innerHTML`.
- **Prototype-safety** (`form.js`): collected submit values use a null-prototype object,
  so a field named `__proto__`/`constructor` can't corrupt it.

### Changed
- **`repeat()` relocates rows with the native `Element.moveBefore()` where it exists**, so a
  keyed reorder no longer costs the user their place. That API is a state-preserving atomic
  move; `insertBefore`, which the DOM defines as a remove plus an insert, destroys focus, an
  inner scroll position and an `<iframe>`'s loaded document. Measured through the engine,
  same list, before and after:

  | | focus | caret | inner scroll | iframe |
  |---|---|---|---|---|
  | reversal, before | `false` | 3 | 0 | reloaded |
  | reversal, after | **`true`** | 3 | **60** | **kept** |
  | 20→5 filter, before | `false` | 3 | 0 | reloaded |
  | 20→5 filter, after | **`true`** | 3 | **60** | **kept** |

  The filter row is the one that matters most: a consuming app reported losing focus when a
  reader had tabbed into a row and then narrowed the list, with node identity reporting clean
  the whole time. Appends and prepends were already free and are unchanged.

  **This is a progressive enhancement, not a guarantee.** Chrome/Edge 133+ and Firefox 144+
  have `moveBefore`; **Safari does not**, and there the fallback is exactly what this library
  always did. So a UI that comes to depend on focus surviving a reorder will differ between
  browsers — stated in `reactive.js` and `_agents.md` rather than left to be discovered.
  Detection is on the parent (`typeof parent.moveBefore === "function"`), at call time: the
  parent may be a `DocumentFragment`, and call-time detection is what lets the test shim the
  dispatch. The catch is narrowed to `HierarchyRequestError` — reachable when a row's node
  was removed from the document before the reorder — and redoing the whole row with
  `insertBefore` heals the half-relocated state; any other error is rethrown.

  A custom element inside a relocated row still gets `disconnectedCallback` /
  `connectedCallback` on both paths, since skipping those is opt-in via
  `connectedMoveCallback()` and none of ours define it. Focus inside such a component
  survives anyway, because `renderResult` rebinds in place rather than replacing children.

  `test/reactive.test.mjs` shims `Element.prototype.moveBefore` to pin the dispatch, the
  mid-row-throw recovery and that a non-`HierarchyRequestError` propagates — reverting the
  change fails 3 assertions, where before jsdom could not see the path at all. What the shim
  cannot pin is the benefit itself; that is browser-only and stated in the test.

### Fixed
- **`<puredashboard-upload>.remove()` detaches the element again.** `remove(id)` drops a FILE —
  and `remove` is also `Element.prototype.remove()`, which this class was shadowing outright.
  So `uploadEl.remove()` was a no-op for the DOM, and that is a method the ENGINE calls:
  `Row.remove()` is `for (const n of this.nodes) n.remove()`, so a keyed row whose top-level
  node was an upload could never be dropped — measured, `[1,2,3] → [1,3]` left all three on
  screen while `repeat()` forgot about the ghost. `NodePart.replace` uses `n.remove()` the same
  way. Wrapping the element in any other node hid it, which is why it survived this long. The
  two contracts do not overlap, so both are kept: no argument detaches, an id drops that file.
  Pre-existing. A sweep of all 63 registered tags for methods shadowing the DOM prototype chain
  found this is the only one the engine calls — the 21 `focus` overrides forward to an inner
  control on purpose, and the four `title` props are a declared API choice.
- **A relocated `<puredashboard-lazy>` is printed again.** `PENDING` is the set the
  `beforeprint` hook walks to materialise everything still deferred; `disconnectedCallback`
  removes the element from it and `_placeholder()`, the only thing that adds, runs once behind
  `_inited`. So after a relocation the element was permanently absent from the print set —
  measured, an untouched block renders on `beforeprint` and a moved one stays a placeholder.
  Nothing else changed: `data-state` stayed `pending`, `_inited` stayed true and `renderNow()`
  still worked, which is why a sweep measuring those two saw nothing.
- **`<puredashboard-upload>` no longer leaks a thumbnail URL per file added while detached.**
  The "already-revoked" flag lived on the element, which stops being true of every item the moment
  one is added while disconnected: that item's thumb is live, and re-minting it on reconnect
  overwrote a URL nobody revoked. Measured — created 4, revoked 1, three live URLs for two
  items. The flag is now per item.
- **`<puredashboard-combobox>` no longer leaves a listener on `document` after it is removed.**
  Opening the popup registers a `pointerdown` handler on `document` for light-dismiss, and
  nothing took it back — removing an open combobox left it registered for the page's lifetime,
  holding a reference to the element and re-running `_close()` on every pointerdown. Measured:
  it still fired after `remove()`.

  This is the MIRROR of the relocation defects above rather than another instance of them:
  those tore something down and never restored it; this sets something up and never tears it
  down. It was found by sweeping the axis the relocation sweep does not cover — components with
  no `disconnectedCallback` at all. The teardown deliberately does not touch `_open`, because a
  relocation is a disconnect plus a reconnect and closing there would drop a popup the user
  still has open; the listener is re-registered on connect, and `_syncPopup()` already
  re-anchors the popup on every render.
- **Moving a `<puredashboard-tooltip>` no longer kills it outright.** Its listeners are removed
  in `disconnectedCallback`, and the method that wired them was guarded to run "exactly once
  across reconnects" — so after a relocation the tooltip was permanently dead. Measured: focus
  showed it before a move and did nothing after. Building the tip stays once-only; the wiring
  now runs on every connect (`addEventListener` de-dupes an identical triple, so a connect that
  did not follow a disconnect is a no-op). Nothing about this needs a reorder to reach it —
  wrapping the element in a new parent is enough.

  Its second half is the stranded tip: the panel is `position: fixed`, anchored once from
  `getBoundingClientRect`, and nothing hid it on disconnect, so a relocation left it at the old
  coordinates — measured at 331px away under `insertBefore` and 329px under an atomic move, so
  this predates the `moveBefore` work rather than being caused by it. On reconnect a showing tip
  is now re-anchored if its trigger still holds focus, and hidden if it does not: a tip showing
  for a reason that no longer exists should go, not follow.
- **Moving a `<puredashboard-upload>` no longer kills its thumbnails.** `disconnectedCallback`
  revokes every object URL, which is right for an element that is leaving — but a relocation
  is a disconnect plus a reconnect, so a keyed `repeat()` reorder (or a filter leaving
  survivors non-adjacent) ran both, and afterwards every `it.thumb` still pointed at a blob
  that had been revoked. Measured in Chrome, one image, one reorder:

      before   thumbnail OK -> BROKEN, url string unchanged (revoked, not replaced)
      after    thumbnail OK -> OK,     url replaced with a fresh one

  Nothing rebuilt them, and nothing reported it — the element re-rendered happily with an
  `<img src>` pointing at a dead URL. The `File` was never lost, so the URLs are now re-minted
  on reconnect. Identical on the version before the `moveBefore` work, so this was not caused
  by it: a custom element gets `disconnectedCallback` on both relocation paths. Found by an
  independent review as a code-reading hunch and confirmed by measurement here.

  This is the third component in the same shape — after `popover`/`popconfirm`, which leaned
  on the browser dropping a panel that left the document. The pattern worth naming: **a
  component that frees a resource in `disconnectedCallback` and does not restore it in
  `connectedCallback` is broken by relocation, not just by removal.** `tooltip` is the one
  still open.
- **Moving a `<puredashboard-markdown>` no longer re-parses it or rebuilds its DOM.**
  `connectedCallback` painted unconditionally, and re-parenting a node runs it again, so
  every move re-parsed the source and replaced the whole rendered subtree — for output that
  was byte-identical. Node identity, and anything an app had hung on those nodes, was lost
  for nothing; a keyed `repeat()` reorder paid it per row. A `_dirty` flag now separates
  "has a source" from "has painted that source", which `_set` could not: a `.value` set
  before the first connect needs painting and an already-painted element being moved does
  not, and both are `_set === true`. One rule holds everywhere now — only a source change
  repaints, and a move is not a source change. `_dirty` starts **true** so the first connect
  still normalises whatever it was given, including whitespace-only children, which
  otherwise never took the adopt branch and would have kept their raw text node.
  Consequence worth knowing: children you replace by hand now survive a move too, where a
  move used to silently repaint over them.
- **Moving a `<puredashboard-markdown>` no longer destroys the markdown it was given.**
  Only the *inline* form was affected — source passed as the element's children rather
  than through `.value`. Re-parenting a node is a remove plus an insert, so
  `connectedCallback` runs again; the inline fallback re-read `textContent`, which by then
  was the element's own rendered output. `# Heading` had become an `<h1>` whose text is
  `Heading`, so the hash was gone for good and sibling blocks came back welded into one
  paragraph — `<h1>Heading</h1><p>Paragraph.</p>` → `<p>HeadingParagraph.</p>`, and moving
  again could not recover it. The source is now adopted once. Reported against a keyed
  `repeat()` reorder, but it needed neither: any re-parent did it, including wrapping the
  element in a new node. A sweep of all 63 registered tags found no other component whose
  content changes on a move. `.value`-sourced markdown was never affected.
- **A wrapping `<label>` no longer names the WRONG control.** Every form-associated
  component mirrors a wrapping `<label>` onto its inner control as `aria-labelledby`,
  stamping that label with an id when it has none. The id came from a `let labelId = 0`
  **in each component file** — twelve separate module scopes sharing one `pd-label-`
  prefix — so the first `<label>` around a `<puredashboard-select>` and the first around
  a `<puredashboard-input>` were both `pd-label-1`. `getElementById` returns whichever
  comes first in the DOM, so on a form holding two different components the second one
  announced the first one's name; and since `aria-labelledby` outranks `aria-label`, the
  author could not override it from outside. Found in a search form whose "Agent" field
  called itself "Project". The counter now lives once, in `reactive.js`, as the exported
  `labelIdFor(node)` — the module every one of these components already imports. Affects
  `input`, `textarea`, `number`, `select`, `combobox`, `checkbox`, `switch`, `slider`,
  `date`, `time`, `color`, `upload`. `test/a11y-names.test.mjs` now mounts one of each on
  ONE page and asserts every label id resolves to its own component (22 failures before
  the fix — the bug is invisible to any test that mounts a single component).
  `labelIdFor` also skips ids the **embedding page** already holds: `pd-label-<n>` is not
  reserved for us, and an author element sitting on one produced the same wrong name from
  outside the library.
- **Accessible names now reach the right element (library-wide).** A custom-element host
  carries no role, so an `aria-label` put on it was silently dropped — and several
  components additionally **deleted** the author's value on every render, overwriting it
  with their own `LABELS` default. Found while building an icon-only menu trigger
  (`<puredashboard-button>` + `icon`), then audited across every component:
  - **Mirrored onto the inner native control** (so a screen reader announces it):
    `button` (inner `<button>`/`<a>`), `input`, `textarea`, `number`, `select`,
    `combobox`, `checkbox`, `switch`, `slider`, `date`, `time`, `color`, `upload`.
    These also mirror `aria-labelledby` **and any `<label>` associated with the host**
    (wrapping it, or `label[for]`) — previously a wrapping `<label>` named the
    form-associated host and never reached the control inside it.
  - **Applied to the role-bearing root, overriding the built-in name**: `rate`,
    `progress`, `tabs`, `breadcrumb`, `pagination`, `nav`, `splitter`, `steps`,
    `timeline`, `list`, `alert`, `table`, `collapse`, `badge`.
  - **No longer clobbered on the host** (these carry their role on the host):
    `spinner`, `skeleton`, `avatar`, `divider` — a component default now only fills in
    when the author set no name, and only the component's own value is ever replaced.
  - `tree`, `segmented`, `radio-group`, `menubar`, `card`, `grid` already behaved; they
    are pinned by the new cross-cutting suite `test/a11y-names.test.mjs` (62 assertions)
    plus `test/a11y-names-harness.html` for the computed names in a real browser.
- **Router** (`router.js`): a malformed `%`-escape in a route param (e.g. `#/x/%`) no
  longer throws an uncaught `URIError` that wedged `render()` — it falls back to the raw
  capture.

### Docs
- **Corrected what a keyed `repeat()` row keeps.** `repeat()`'s own comment claimed rows
  whose key persists keep "any focus/scroll inside". True of a row left where it is, false
  of one the reconciler RELOCATES: relocation runs through `insertBefore`, a remove plus an
  insert, so focus is lost, an inner scroll container resets to 0, and a custom element in
  the row is disconnected and reconnected. (Selection offsets survive — it is the focus
  that goes.) And which rows get relocated is a property of the diff, not of what you
  called the update: reversing `[1,2,3]` relocates the focused row, rotating it to
  `[2,3,1]` does not, and a removal leaving survivors non-adjacent (`[1,2,3,4,5]` →
  `[1,3,5]`) relocates rows just as a reorder does. That is the trap: node identity is the
  metric anyone checks first and it comes back clean either way. Restated in `reactive.js`
  and `_agents.md`; `test/reactive.test.mjs` pins the coupling — a row that was relocated
  is a row that lost focus — across five diff shapes, rather than any one permutation.
- `Row.moveBefore` is ours and built on `insertBefore`; it is not the native `moveBefore()`
  whose name it shares. That one is on **`Element`**, not `Node` — called as
  `parent.moveBefore(node, ref)`, detected as `"moveBefore" in Element.prototype`. Noted in
  place, with what adopting it would and would not buy: it preserves focus and inner
  scroll, but it is Chrome/Edge 133+ and Firefox 144+ with no Safari, and it only skips
  disconnected/connectedCallback for custom elements that opt in via
  `connectedMoveCallback()`.
- **The parts engine is now documented in the file that SHIPS.** `repeat()` and
  `renderResult()` are exported and work on any container — no `Reactive` subclass
  needed — but `_agents.md` never mentioned either, scoped authoring out ("only relevant
  if you EXTEND the library"), and pointed five times, across four files, into `docs/`,
  which does not ship. A consuming app that vendored `src/` therefore had no way to reach
  the answer, and one reached for hand-built DOM plus its own scroll anchoring instead. New
  recipe *Your app renders its own views*, and a header note saying `docs/…` means the
  source repo.
- **Documented the half of in-place diffing that existed nowhere: template identity.** A
  binding whose value is unchanged writes nothing (so a `.value` binding does not clobber
  half-typed text) — that half `docs/ARCHITECTURE.md` already stated, as "a no-op when
  unchanged". What it never said is the consequence: the thing that *does* destroy an input
  is switching template identity, because `${cond ? html`…` : html`…`}` is two `strings`
  arrays and flipping it replaces the nodes. `test/reactive.test.mjs` now pins both
  directions (9 assertions), including that the rebuild really does lose the text, so the
  failure mode cannot drift into looking safe.
- Document the trust boundary (component props are trusted author config;
  `accept`/`maxSize` are UX hints — validate on the server) in `_agents.md` / `upload.js`.

## [0.1.0] - 2026-06-26

First public release — extracted into a standalone, zero-dependency, no-build library.

### Added
- **Template engine** (`reactive.js`): a lit-html-style parts engine that diffs the DOM
  in place (so `<input>` focus/caret/scroll survive re-renders), the `repeat()` keyed-list
  directive, `renderResult`, and the `Reactive` custom-element base. No `eval`/`new Function`.
- **String templating** (`html.js`): escaped `html`, plus `raw`, `icon`, `escapeHTML`.
- **Components**
  - `<puredashboard-table>` — sortable columns, filter, pagination + rows-per-page,
    row selection with a bulk-action bar, per-row actions.
  - `<puredashboard-upload>` — drag-and-drop, thumbnails, per-file progress, native
    multipart form submit; plus `uploadFile()`.
  - `<puredashboard-markdown>` — XSS-safe Markdown rendered `textContent`-only with an
    href whitelist; plus `parseMarkdown` / `renderMarkdown`.
- **Imperative overlays** — `dialog` / `drawer` / `alert` / `confirm` / `prompt`,
  `menu()`, and `toast` (+ `.success/.error/.warn/.info`), all on the native top layer.
- **Router** (`router.js`) — hash or History API modes, params, catch-all 404,
  lazy-loaded pages, layouts, and guards.
- **Optional theme** (`src/theme/`) — `tokens.css` (light/dark palette), `base.css`
  (form controls), `shell.css` (dashboard frame), and `dashboard.css` (all-in-one).
  Dark by default, light via `prefers-color-scheme`, forceable with `data-theme`.
- **Docs & tooling** — README, `docs/ARCHITECTURE.md`, `docs/USAGE.md`,
  `docs/DEVELOPMENT.md`; jsdom test suite run in Docker (`make -C test`); a browser
  showcase/demo harness under `test/`.

### Changed
- Toasts now use the elevated `--panel` surface (consistent with `menu` / `dialog`), so
  they read as crisp cards instead of relying on a low-contrast background.

[Unreleased]: https://github.com/madnh/puredashboard/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/madnh/puredashboard/releases/tag/v0.1.0
