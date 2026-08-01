# Changelog

All notable changes to PureDashboard are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Versions map to git tags / GitHub Releases (e.g. `v0.1.0`). While the version is `0.x`,
the API may still change between minor versions.

## [Unreleased]

### Added
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

### Fixed
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
