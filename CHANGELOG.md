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
- **`<puredashboard-input>` forwards native input attributes.** `list`, `autocomplete`,
  `inputmode`, `maxlength`, `minlength`, `min`, `max`, `step`, `pattern`, `enterkeyhint`,
  `autocapitalize` and `spellcheck` authored on the host are copied to the inner `<input>`
  after every render (and removed from it when removed from the host). Before, they sat on
  the wrapper where the browser ignores them, so a `<datalist>`, a numeric range or a mobile
  keyboard hint had no effect. Upstreamed from model-gateway (GW-160).
- **`<puredashboard-combobox>` can be fed by the app (server search, refresh, clear).**
  New events `comboboxopen` (each time the list opens, including reopening by typing
  after Escape) and `comboboxsearch` (`detail.text`, per keystroke); new properties
  `serverFilter` (typed text does not filter `options` locally — the app answers
  `comboboxsearch` with new `options`), `loading` (only a "Loading…" row; the old options
  are hidden and cannot be committed) and `clearable` (a clear button while a value is
  set; emits `change` with `""`). New `labels` keys `loading`, `clear`. All opt-in.
  Upstreamed from model-gateway (GW-162); the vendor patch's event names
  `combobox-open` / `combobox-search` became `comboboxopen` / `comboboxsearch` (library
  event names are one lowercase word, and a bare `open` would collide with the bubbling
  `open` of `<puredashboard-popover>` / `<puredashboard-popconfirm>`).
- **`<puredashboard-progress inline>`**: an `inline` host attribute makes the bar
  `inline-block` (vertically centred), so a thin bar can sit on the same line as text.
  Default stays `block`. Upstreamed from model-gateway (GW-161).
- **`<puredashboard-form>` names and lays out its `<form>` from host attributes.**
  `aria-label`, `aria-labelledby`, `aria-describedby` and `autocomplete` authored on the
  host are moved onto the inner `<form>` (on connect and on later changes); an authored
  `aria-label` replaces the English default name, so no `labels.form` override is needed.
  `direction="row"` lays the fields out in a wrapping row aligned on their bottom edge
  (a filter bar). Without them nothing changes. Upstreamed from model-gateway (GW-161).
- **`<puredashboard-table>`: `rowAttrs`, per-column `thAttrs`, `wrap-headers`.**
  `rowAttrs(row, index)` returns attributes for each row's `<tr>` (`data-*`, `id`…;
  `class` is added to the row's classes; `null`/`false` removes) and a column's
  `thAttrs` does the same for its `<th>` (e.g. `aria-sort` for a server-sorted,
  non-`sortable` column). Both are re-applied after every render. A `wrap-headers` host
  attribute lets long header labels wrap. Upstreamed from model-gateway (GW-161).
- **`<puredashboard-alert live>`**: chooses the box's role by use instead of by colour —
  `alert` | `status` | `none` (`none` carries no name); any other value is ignored. Unset
  keeps the role by type (error/warning = alert, info/success = status). Upstreamed from
  model-gateway (GW-161).
- **`<puredashboard-collapse>`: `headingLevel` and `regions`.** Every header sat in an
  `<h3>` and every panel was a `role="region"`, so a long list of disclosures added as
  many headings and landmarks to the page outline. `headingLevel` = `1`–`6` renders a
  `role="heading"` with that `aria-level` (`3` = the native `<h3>`), `"none"` a plain
  `<div>`; unset or invalid keeps the `<h3>`. `regions = false` drops the per-panel
  region role. Defaults unchanged. Upstreamed from model-gateway (GW-161).
- **`<puredashboard-pagination hasMore>` for cursor (keyset) paging.** When the total is
  unknown, `hasMore` (attribute `has-more`) treats `pageCount` as the pages reached so
  far and offers one more after them, with a trailing `…` while more may follow.
  `pagechange` now also carries `direction` (`"next"` | `"prev"`, relative to the previous
  page) — additive, `detail.page` is unchanged. Upstreamed from model-gateway (GW-163).
- **`<puredashboard-tabs>` link mode.** When any tab has an `href`, the bar renders a
  `<nav>` of real `<a>` links styled as the same tabs (open in a new tab, back/forward
  and middle-click work): the tab for `value` carries `aria-current="page"`; there are no
  tab roles, no roving tabindex, no arrow keys, no panels (`panelId` is ignored) and no
  `tabchange` — navigation is the browser's. A tab that is `disabled` or has no `href`
  renders as a non-link `<span aria-disabled="true">`. Without any `href` nothing changes.
  Upstreamed from model-gateway (GW-163).
- **`<puredashboard-datetime>`** (`datetime.js`): a local date-and-time picker, the
  `datetime-local` sibling of `<puredashboard-date>` / `<puredashboard-time>` and built
  the same way — a native input inside, form-associated, value `yyyy-mm-ddTHH:mm` (or
  `…:ss` when `step` admits seconds) with **no time zone** (convert it yourself),
  `min`/`max`/`step`/`required`/`readonly`/`size`/`error`/`labels`, native `input` /
  `change` events. Upstreamed from model-gateway (GW-163).
- **`<puredashboard-field>`** (`field.js`): a form field wrapper — a visible label above
  ONE control the author puts inside (a PureDashboard control or a native
  input/select/textarea), an optional hint and an optional error below it, with the ARIA
  wiring done: `<label for>` (id generated if missing), a label click focuses a
  custom-element control, the label id in `aria-labelledby` and the hint/error ids in
  `aria-describedby` of the control's inner native field, `aria-invalid="true"` while
  there is an error — kept when the control re-renders, also for a control appended after
  connect, and removed again when cleared. Plain `HTMLElement`, light DOM, the control is
  never moved or wrapped; text is set with `textContent` only. Upstreamed from
  model-gateway (GW-163).
- **`theme/shell.css`: `.app-frame`** for an element that has to sit between `<body>`
  and the shell (a router outlet, a mount point). `<body>` is a fixed 100vh column that
  scrolls only `<main>`, but such a wrapper was sized by its content, so the whole page
  scrolled and the sider scrolled with it. `.app-frame` is a flex column that fills
  `<body>`, has `min-height: 0` and scrolls itself. Upstreamed from model-gateway (GW-163).
- **`dialog({ actions })`**: footer buttons rendered by the library. Each
  `{ label, value?, variant?, danger?, disabled?, attrs?, onclick? }` becomes a
  `<puredashboard-button>` in a `.puredashboard-dialog__actions` row appended to the
  footer (created when there is no `footer`). A click calls `onclick(ev, ctrl)` if given,
  otherwise closes the dialog with `value`; the elements are returned as `ctrl.actions`.
  `button.js` is loaded on demand the first time actions are used, so the buttons work
  even if the app never imported it, and a dialog without `actions` stays
  dependency-free. Without `actions` nothing changes. Upstreamed from model-gateway
  (GW-167).
- **`<puredashboard-button>` toggle semantics.** Opt-in `role`, `aria-checked` and
  `aria-pressed` on the host are moved to the inner `<button>` (removed from the host, so
  a switch or toggle button is one node in the accessibility tree); setting the host
  attribute again updates the state, an empty string clears it. Without them nothing
  changes. Upstreamed from model-gateway (GW-167).
- **`<puredashboard-combobox multiple>`**: multi-select. `value` is a `string[]`; chosen
  options show as removable `<puredashboard-tag>` chips before the text box (which still
  filters); the list stays open after a pick and a pick toggles; chosen options are
  `aria-selected` in an `aria-multiselectable` listbox; Backspace on an empty text box
  removes the last chip; removing a chip moves focus to the next chip, else the previous,
  else the text box without opening the list; Tab only closes; the form value is `name`
  repeated once per value; `change` carries the array; new `labels` key `remove(label)`.
  Without `multiple` the DOM, values, events and form value are unchanged (golden replay
  in the tests). `combobox.js` now imports `tag.js`. Upstreamed from model-gateway
  (GW-168).

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
  have `moveBefore`; **Safari does not**, and there RELOCATION is exactly what this library
  always did — executed on Safari 26.5.2, not inferred: `moveBefore` absent, every relocation
  through the fallback, focus lost, selection offsets kept, inner scroll to 0. Overlays are a
  separate claim and DID change on Safari; see the popover entry. Firefox has the API and has
  not been run. So a UI that comes to depend on focus surviving a reorder will differ between
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
- **`<puredashboard-table>` header cells carry `scope="col"`** (selection, data and
  actions columns alike), so assistive tech maps each cell to its column header
  unambiguously. This changes the markup of every table; nothing else about the header
  changes. Upstreamed from model-gateway (GW-161).
- **`<puredashboard-card>` keeps an authored `role`; `scroll` attribute.** The card
  always forced `role="group"` with the English fallback name "Panel". An authored role
  (`region`, `none`…) is now kept; the fallback name applies only to the default group
  role, not when `aria-labelledby` is set, and an empty `labels.region` now means no name
  (it used to write `aria-label=""`). A `scroll` host attribute lets a body wider than
  the card scroll horizontally instead of being clipped. Upstreamed from model-gateway
  (GW-161).

### Fixed
- **`<puredashboard-upload>` gains `removeFile(id)`**, the name that cannot collide with the
  DOM's own `Element.remove()`. `remove(id)` keeps working, and the kept overload now
  discriminates on `arguments.length` rather than on the VALUE being `undefined` — the value
  test could not tell "no argument" from "an argument that is undefined", so
  `up.remove(sel?.id)` with nothing selected **detached the uploader from the page**, silently
  and with no error. That is the ordinary migration idiom, and it is measured. The other edges
  are pinned as they behave: `remove(null)`, `remove(0)` and a stale id are silent no-ops
  rather than detaching, because falling through to a detach would let one stale id destroy the
  whole component. A callback that forwards an index (`el.remove(i)`) therefore detaches
  nothing — `removeFile` exists so that ambiguity is avoidable.
  A miss no longer announces a change either: `removeFile(id)` with an id that matches nothing
  — and therefore `remove(null)`, `remove(0)` and a stale id — used to sync the form and emit
  `files` with the list untouched, waking any consumer listening on that event for nothing.
  A thumbnail whose `createObjectURL` failed transiently also recovers now: the reconnect
  re-mint keys on `isImage && !thumb` as well as on the revoked flag, where before a single
  failure left the item without a thumbnail for the element's life.
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
- **`<puredashboard-combobox allowCustom>` no longer drops typed free text.** Closing the
  list by an outside click or Escape redrew the box from the old value, so the text was
  lost; it is now committed (an exact label match commits that option, otherwise the text
  itself, with `change`). Reopening over free text starts from it instead of an empty
  box. Without `allowCustom` nothing changes: those closes still revert. Upstreamed from
  model-gateway (GW-160).
- **`<puredashboard-tabs>` no longer drops keyboard focus.** The tab buttons re-render on
  every change, so after a click or one ArrowLeft/ArrowRight/Home/End the focused button
  was replaced and focus fell to `<body>` — a second arrow key did nothing. When focus was
  inside the tab list, the newly selected tab is focused after the render; focus outside
  the tabs is never moved. Upstreamed from model-gateway (GW-161).
- **`<puredashboard-alert hidden>` now hides.** The host's `display: block` overrode the
  user-agent `[hidden]` rule, so a hidden alert stayed visible. Upstreamed from
  model-gateway (GW-161).
- **Router: an aborted view transition is no longer an unhandled rejection.** The
  `ViewTransition` returned by `document.startViewTransition` was dropped, so when the
  browser aborted it (viewport resized mid-transition, a newer navigation) its promises
  rejected unhandled and an `InvalidStateError` / `AbortError` showed in the console
  although nothing was wrong. The three promises are now handled; if the browser dropped
  the transition before calling the DOM update, the router runs it itself — unless a
  newer navigation has started since. An error thrown by the page's own mount still
  surfaces, once (it was reported three times). Upstreamed from model-gateway (GW-166).

### Docs
- **A source file git would call binary now fails the suite.** `test/no-binary-sources.test.mjs`
  scans `src/`, `test/` and `tools/` for a NUL in the first 8000 bytes — git's own rule for
  classifying a blob as binary, after which `git log -p` and `git blame` show nobody its
  diffs. Two such files shipped here and nothing in this repo could have said so; the
  consuming app that found the first suggested making the check a test rather than a memory,
  and it is worth more here than there because they vendor the output. Verified against the
  tree before the fix: it names both offenders with their byte offsets.
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
