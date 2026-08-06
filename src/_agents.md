# PureDashboard — guide for AI agents

> You're reading this because you're wiring PureDashboard into an app. It exists so
> you **don't have to read the component source** to use it. Everything you need —
> the rules, the copy-paste recipes, and a full component index — is here. For the
> exhaustive machine-readable API, see **`_components.jsonl`** next to this file —
> one JSON line per component (props/events/attrs/CSS vars/example).
>
> This file ships inside `src/` (as `_agents.md`), so it travels when someone copies
> the folder. It is skipped by the `//go:embed` walker (leading `_`), so it never
> bloats a backend binary.
>
> **`docs/…` paths below are in the source repo, NOT in this copy.** Only `src/`
> ships, so a vendored copy has this file and `_components.jsonl` and nothing else.
> They're at <https://github.com/madnh/puredashboard> — worth fetching if you're
> extending the library rather than only consuming it.

## What this is

A vanilla, **zero-dependency, no-build, CSP-safe** UI component library: ~50 custom
elements + a few imperative helpers. Files in `src/` are shipped to the browser
**as-is** — no npm, no bundler, no transpile. It runs under `script-src 'self'`.

## The two golden rules

1. **Wiring:** link the CSS you use (or the one-file bundle), `import` the JS module
   (which `define()`s the element), then create the element and set **properties in
   JS** (not attributes) for anything non-trivial (arrays/objects/functions).
2. **Untrusted content** (anything user- or AI-authored) goes through
   `<puredashboard-markdown>` or `textContent` — never build HTML strings.

## Setup

```html
<!-- one-file bundle of every component's CSS … -->
<link rel="stylesheet" href="LIB/components.css" />
<!-- … plus ONE theme file so it looks polished (optional but recommended) -->
<link rel="stylesheet" href="LIB/theme/dashboard.css" />  <!-- tokens + base + shell -->
<!-- or just the palette: <link rel="stylesheet" href="LIB/theme/tokens.css"> -->
```
```js
import "LIB/table.js";           // defines <puredashboard-table>
const t = document.createElement("puredashboard-table");
t.columns = [{ key: "name", label: "Name", sortable: true }];
t.rows = data;
document.body.append(t);
```
- Link only the `*.css` you use, or `components.css` for all. Components also work
  with **no theme** (neutral system colours).
- Theme = CSS custom properties. Dark by default; light via `prefers-color-scheme`,
  or force with `<html data-theme="light">`. Override any `--*` token to retheme.
- Compact density: put `data-density="compact"` on any container.
- Desktop apps (Tauri/Wails/Electron): opt into the macOS-native look with
  `<link rel="stylesheet" href="LIB/theme/native.css">` + `<html data-skin="macos">`
  (vibrancy, hairlines, macOS controls). Pair with `puredashboard-titlebar` for a
  frameless window — recipe in `docs/DESKTOP.md`.

## Which `html` tag? (only relevant if you BUILD views, not just use components)

Two tagged templates exist. If you only place components and set properties, you need
neither. If you render your own markup — your own custom element, or a routed page —
pick: `reactive.js` `html` (diffs the DOM in place, for anything holding input, focus
or scroll) vs `html.js` `html` (one-shot string→innerHTML, escaped; static fragments
and inline SVG). Recipe below: *Your app renders its own views*. Full design rules in
`docs/DEVELOPMENT.md` (source repo).

## Four component families

1. **Reactive custom elements** — most components. Configure via JS properties;
   they re-render. Form inputs are **form-associated** (submit + validate natively).
2. **Imperative overlays** — `dialog`/`drawer`/`alert`/`confirm`/`prompt`, `menu`,
   `toast`. Plain functions you *call and await*; they show in the top layer.
3. **Pure-DOM** — `<puredashboard-markdown>` (XSS-safe, `textContent` only).
4. **Child-adopting** — `<puredashboard-splitter>` (panels), `<puredashboard-toggle-group>`
   (toggles), `<puredashboard-lazy>` (a `<template>` + a fallback). You give them real
   light-DOM **children**; they wire behaviour around them instead of rendering content.

---

## Recipes (the non-obvious bits)

### Forms + validation (form-associated)
Every input participates in a native `<form>`. `<puredashboard-form>` wraps children
in a real form and centralises submit:
```js
import "LIB/form.js"; import "LIB/input.js"; import "LIB/select.js";
const f = document.createElement("puredashboard-form");
f.innerHTML = "";                               // (build via DOM, not strings, for untrusted)
const email = Object.assign(document.createElement("puredashboard-input"), { type: "email", required: true });
email.setAttribute("name", "email");            // name drives the submitted field
f.append(email /*, more fields, a <button type=submit> */);
f.addEventListener("submit", (e) => console.log(e.detail.values));   // { email: "…" }
f.addEventListener("invalid", () => {/* first bad field is focused */});
```
- Any input alone also works inside a native `<form>`; it submits under its `name`.
- Read/set the value via the element's `.value` (checkbox/switch: `.checked`).
- Native `input`/`change` events **bubble** from inputs — listen on the element.

### Overlays (call & await; they use the native top layer)
```js
import { confirm, alert, prompt, dialog, drawer } from "LIB/dialog.js";
if (await confirm("Delete 3 services?")) { /* … */ }        // → boolean
const name = await prompt("New name?", { value: "web-01" }); // → string | null
dialog({ title: "Edit", content: (body) => body.append(myForm), onClose: (v) => {} }).show();
drawer({ position: "right", title: "Filters", content: (b) => {} }).show();
```
```js
import { menu } from "LIB/menu.js";              // anchored dropdown
const picked = await menu(anchorEl, [
  { label: "Open", href: "#/nodes/web" },                       // a real <a> link
  { label: "Edit", value: "edit", icon: SVG_STRING, shortcut: "F2" },
  { group: "Columns", items: [                                  // labelled group …
    { label: "Status", checked: true, onSelect: (it, on) => {} },  // … checkbox item
  ] },
  { group: "Sort by", radio: "name", onSelect: (v) => {}, items: [ // … radio group
    { label: "Name", value: "name" }, { label: "Date", value: "date" } ] },
  { label: "Share", items: [{ label: "Copy link", value: "copy" }] },  // submenu
  { separator: true },
  { label: "Delete", value: "delete", danger: true },
]);                                              // → chosen value | null
```
- **Icons:** `icon` is an inline **SVG markup string or a DOM node** (trusted author
  config, like `raw()`). A menu that has *any* icon reserves the icon gutter on **every**
  item, and a menu with *any* checkable item reserves the indicator gutter — so labels
  line up whether or not an item carries one. Checkbox/radio indicators sit in their own
  slot, so an item can show both a checkmark and an icon.
- Checkbox / radio items keep the menu **open** (toggle several); actions and links close
  it. Override per item with `closeOnSelect`. Keyboard: arrows, Home/End, typeahead,
  ArrowRight/ArrowLeft (or Enter/Esc) to enter/leave a submenu.
- The returned promise also carries `.close(value?)` and `.el` so a caller (e.g. a
  menubar) can drive the open menu.

**Overflow menus (keep a busy UI tidy).** Show the one or two frequent actions and
collapse the rest behind a single icon trigger — a **kebab `⋯`** for one row/card's own
actions, a **hamburger `☰`** for a whole nav/command set on narrow screens:
```js
const more = Object.assign(document.createElement("puredashboard-button"),
  { variant: "text", shape: "circle", size: "sm", icon: ICON_KEBAB });
more.setAttribute("aria-label", "More actions for api-gateway");   // REQUIRED: no visible text
more.addEventListener("click", (e) => {
  const btn = e.currentTarget.querySelector(".js-puredashboard-button__el");  // the real <button>
  menu(btn, rareActions, { placement: "bottom-end" }).then(run);              // hugs the right edge
});
```
- An **icon-only button MUST carry `aria-label`** — it's mirrored onto the inner
  `<button>`, which is what screen readers announce.
- Anchor the menu on that inner `.js-puredashboard-button__el`: it's the element that
  takes focus and receives `aria-haspopup`/`aria-expanded`.
- A whole `<puredashboard-menubar>` collapses the same way — map `menus` to items with
  nested `items`, and each title becomes a submenu inside one `☰`.
```js
import { toast } from "LIB/toast.js";
toast.success("Saved"); toast.error("Failed", { duration: 0 /* sticky */ });
const t = toast.warn("Reconnecting…"); t.close();
```

### Router (hash or History API)
A page's `load()` returns a module whose **default export is a tag name (string)**
or a **mount function `(outlet, ctx) => cleanup?`**.
```js
import { Router } from "LIB/router.js";
const router = new Router({
  outlet: "#view", appName: "Admin", mode: "hash",   // "hash" (default) or "history"
  routes: {
    "/":            { title: "Overview", load: () => import("./pages/home.js") },
    "/nodes/:name": { title: (p) => `Node ${p.name}`, load: () => import("./pages/node.js") },
    "*":            { title: "Not found", load: () => import("./pages/404.js") },
  },
});
router.start();
// A page module: export default (outlet, ctx) => { outlet.replaceChildren(view(ctx.params)); };
// No page files? Inline it: load: () => Promise.resolve({ default: (o) => {…} })
```
Use real `<a href="#/nodes/web">` links; the router only *reacts* to navigation.

### Untrusted / rich text
```js
import "LIB/md.js";
const md = document.createElement("puredashboard-markdown");
md.value = someUntrustedMarkdown;   // rendered with textContent only; href-whitelisted
```

### Copy to clipboard (text, HTML or an image)
```js
import "LIB/copy.js";
const c = document.createElement("puredashboard-copy");
c.value = "npm i";                       // string · Blob/File · <img> · <canvas> · (async) fn
c.label = "Copy";                        // omit → an icon-only button, already named "Copy"
c.addEventListener("copied", (e) => {}); // detail: { type, value, blob }
c.addEventListener("copyerror", (e) => {});
// or point it at what holds the value, instead of setting it:
// <puredashboard-copy from="#token" variant="text"></puredashboard-copy>
// <puredashboard-copy src="/chart.png" type="image" label="Copy chart"></puredashboard-copy>
```
- The event is **`copied`**, not `copy` — the platform's own `copy` (Ctrl+C) event also
  bubbles, so listening for `copy` would mix the two.
- **Tables paste into Excel / Google Sheets as real cells.** Point `from` at a `<table>`
  (no `type` needed — an element that IS a table is inferred as `html`): the `text/html`
  half carries its `outerHTML` and the `text/plain` half is **TSV** (tab per cell,
  newline per row), so "Paste Special → Text" still fills a grid instead of one cell.
  For a `<puredashboard-table>`, aim at the inner grid: `from="#svc table"`.
  `type="html"` on any other element copies its `outerHTML` the same way, and block
  elements / `<br>` become line breaks in the plain-text half.
- Images are transcoded to **PNG** (the only format clipboards reliably take) and need a
  **secure context** (https/localhost) + CORS for a cross-origin URL. Plain text also
  works over insecure HTTP through the legacy `execCommand` path.
- Failure is never silent: the button turns red, announces it, and emits `copyerror`.
- The button feeds back on its own (check ✓ for `feedback` ms) — no toast needed, though
  `copied` is there if you want one.

### Naming a component for screen readers
Put **`aria-label` (or `aria-labelledby`) on the element itself** — every component
routes it to whatever actually carries the semantics:
```js
input.setAttribute("aria-label", "Email address");          // → the inner <input>
tabs.setAttribute("aria-label", "Service views");           // → the role="tablist"
iconBtn.setAttribute("aria-label", "More actions");         // → the inner <button>
```
- Form controls mirror it onto the **inner native control** (as they do for a `<label>`
  that wraps or points at the host) — that's the element AT announces.
- Widgets apply it to their **role-bearing root**, overriding the built-in `LABELS`
  name; `spinner`/`skeleton`/`avatar`/`divider`/`card` carry their role on the host, so
  the name simply stays there.
- A component's default name **never overwrites** one you set.
- **Icon-only controls MUST have one** (a `<puredashboard-button>` with `icon` and no
  children has no other name).

### Rich content in a component (embed a child element)
Most **content-bearing props** are interpolated at a **child position** by the reactive
engine, so a prop documented as "text" is not text-only — each accepts **either** a
**string** (auto-escaped; safe for untrusted text) **or** a **DOM node**, a nested
**`html\`\`` template** (from `reactive.js`), or an **array** of those — rendered as-is,
to embed a custom element / rich markup. This covers e.g. `collapse` item
`header`/`content`; `list` `title`/`description`/`extra`/`header`/`footer`; `alert`
`title`/`message`; `statistic` `title`/`prefix`/`suffix` (not `value`); `timeline`
`content`/`label`; `descriptions` `label`/`value`/`title`; `tabs`/`segmented`/
`radio-group`/`breadcrumb`/`tree`/`nav` `label`; `nav` `badge`; `checkbox`/`switch`
`label`. (`table` `columns[].label`/`actions[].label` and a `column.render(row)` return
value work the same way.)
```js
import { html } from "LIB/reactive.js";   // the parts-engine html, NOT html.js
const c = document.createElement("puredashboard-collapse");
c.items = [
  { key: "a", header: "Metrics", content: html`<puredashboard-table></puredashboard-table>` },
  { key: "b", header: "Note",    content: someElement },   // a real DOM node also works
  { key: "c", header: "Plain",   content: "just text" },   // a string is auto-escaped
];
```
Two caveats:
- **Nodes/templates are NOT escaped** — you build them, so you own their safety (same
  trust boundary as `raw()`/`icon`/`render`; see Invariants). Untrusted data still goes
  through `textContent` / `<puredashboard-markdown>` or as a **plain string** (escaped).
- A few labels double as an **accessible name**: `steps` step `label` and `nav` **group**
  `label` also feed an `aria-label`. A node there renders visually but corrupts the a11y
  name (`[object Object]`) — keep those a plain string.

### Many heavy items on one page → lazy-render them
A page with dozens of `<puredashboard-json-view>` / `<puredashboard-markdown>` / tables
pays for all of them up front. Wrap each in `<puredashboard-lazy>` and the work happens
when the item scrolls into view (`<img loading="lazy">`, for components):
```html
<puredashboard-lazy height="180px">
  <template>                                   <!-- inert: not parsed, not upgraded -->
    <puredashboard-json-view></puredashboard-json-view>
  </template>
  <puredashboard-skeleton data-lazy-fallback lines="3"></puredashboard-skeleton>
</puredashboard-lazy>
```
```js
const lz = document.createElement("puredashboard-lazy");
lz.height = "240px";                                  // reserve the space → no jump
lz.render = (host) => Object.assign(document.createElement("puredashboard-json-view"), { data: row });
lz.addEventListener("render", () => {/* it's live now */});
// or defer the MODULE too — same contract as a router page:
lz.load = () => import("./heavy-chart.js");
```
- `trigger`: `visible` (default, IntersectionObserver + `rootMargin`), `idle`, `eager`, `manual`.
- No fallback given? A built-in shimmer of `height` is shown. `data-state` (`pending` →
  `rendering` → `rendered` | `error`) is on the host for CSS/tests.
- `unrender` also tears content down when it scrolls far away (very long lists).
- Printing renders everything pending first; note that un-rendered content is NOT
  findable with Ctrl+F, so don't hide content the user must be able to search.
- This is *not* CSS `content-visibility: auto` — that skips layout/paint but still builds
  every node. Use `lazy` when BUILDING is the cost; they compose.

### Your app renders its own views (the parts engine, no subclassing needed)
`repeat()` and `renderResult()` are exported from `reactive.js` and take **any**
container. You do NOT have to extend `Reactive` to use them — a routed page built by
hand can adopt them for one list and leave the rest imperative:
```js
import { html, repeat, renderResult } from "LIB/reactive.js";
const draw = () => renderResult(html`
  <input class="q" .value="${query}">
  ${repeat(sections, (s) => s.n, (s) => html`<p class="row">§${s.n} ${s.text}</p>`)}`, outlet);
```
- **Rows whose key persists keep their existing DOM nodes.** Only new keys build DOM,
  only dropped keys remove it. A row left where it is keeps everything: scroll, focus, and
  anything you hung on the node (`dataset`, listeners, an "already seen" mark) — which is
  what makes an append-only feed cheap. Use it instead of `replaceChildren()` + rebuild;
  the bookkeeping you'd write by hand is what keyed reuse gives you.
- **A row the diff RELOCATES keeps only the node, and node identity won't tell you.**
  Relocation goes through `insertBefore`, which the DOM defines as a remove plus an
  insert: the node is the same node afterwards, and focus is gone, an inner scroll
  container is back at 0, and any custom element in that row has had `connectedCallback`
  run again. (Selection offsets do survive — it's the focus that's lost.)
- **Which rows get relocated is a property of the diff, not of what you called it.**
  Measured: reversing `[1,2,3]` relocates the focused row; rotating it to `[2,3,1]`
  relocates a different one and focus survives; a removal leaving survivors non-adjacent
  (`[1,2,3,4,5] → [1,3,5]`) relocates rows just like a reorder; appends, prepends and
  head/tail/contiguous removals relocate nothing. So don't reason from "this is only a
  removal" — if a row holds focus or scroll you care about, check that, not the node.
- **A binding whose value is unchanged writes nothing.** `.value="${query}"` will not
  overwrite half-typed text when some *other* property re-renders the view. You don't
  have to drop the binding to keep an input usable.

**The one thing that DOES destroy an input: changing template identity.** A `${}` child
position reuses its DOM only while it holds the **same** template literal — a different
literal replaces the nodes, so focus, caret and un-committed text go with them:
```js
// ✗ two literals: switching branch rebuilds the <input>, typed text is gone
${on ? html`<span class="on"><input .value="${q}"></span>`
     : html`<span class="off"><input .value="${q}"></span>`}
// ✓ one literal, the difference is a binding
html`<span class="${on ? "on" : "off"}"><input .value="${q}"></span>`
```
Same rule inside `repeat()` — one template per row, and a key that doesn't change for
that row. If a row varies a lot by type, bind the differences rather than branching.

### Preview your own components (the gallery is reusable)
```js
import "LIB/gallery.js";
const g = Object.assign(document.createElement("puredashboard-gallery"), { route: true });
g.stories = [{ tag: "my-el", title: "Mine/My el", stories: [{ name: "Basic", render: () => document.createElement("my-el") }] }];
document.body.append(g);   // ?overview=1 = contact sheet, ?only=1 = single story
```

---

## Component index

Set the listed props in JS; listen for the listed events on the element. `LABELS`
strings are overridable via the `labels` property on every component.

**This table is the front door — it covers 95% of tasks; read it, not the file below.**
The full machine-readable API (every prop/attr/event + CSS custom props + a usage
example, from the JSDoc) lives in **`_components.jsonl`** — one JSON object per line,
one line per component. Do NOT read the whole file: grep the ONE line you need
(~0.3–2k tokens) and pipe it to `jq` / node / python.

```sh
# the whole record for one component, pretty-printed:
grep '"tag":"puredashboard-table"' src/_components.jsonl | jq

# just its props (no jq? use node or python — both ship everywhere):
grep '"tag":"puredashboard-table"' src/_components.jsonl \
  | node -e 'JSON.parse(require("fs").readFileSync(0)).props.forEach(p=>console.log(p.name,"-",p.desc))'
grep '"tag":"puredashboard-table"' src/_components.jsonl \
  | python3 -c 'import json,sys; [print(e["name"],"-",e.get("desc","")) for e in json.load(sys.stdin)["events"]]'

# list every tag: grep -o '"tag":"[^"]*"' src/_components.jsonl
```
Each record: `tag`, `extends`, `summary`, `props[]{name,type,default,desc}`,
`events[]{name,desc}`, `attrs[]`, `slots[]?`, `cssProps[]{name,desc}`, `example`, `file`.

### General & layout
| Tag | Key props | Events | Notes |
|---|---|---|---|
| `puredashboard-button` | `variant`(primary/default/dashed/text/link), `size`, `danger`, `loading`, `block`, `href`, `type`, `icon` | native `click` | label = children; renders `<a>` when `href` set |
| `puredashboard-copy` | `value`(string \| Blob \| `<img>`/`<canvas>`/`<table>` \| fn), `src`(image URL), `from`(CSS selector), `type`(auto/text/html/image), `label`, `showValue`, `variant`(default/text), `size`, `feedback`(ms) | `copied`{type,value,blob}, `copyerror`{error} | copy-to-clipboard button; icon swaps to a check/cross for `feedback` ms + announces it. A `<table>` copies as HTML + TSV (pastes into Excel as cells); images are normalised to PNG and need a SECURE CONTEXT (text degrades to `execCommand`). Named "Copy" by default, so an icon-only one needs no `aria-label` |
| `puredashboard-divider` | `orientation`, `dashed`, `textAlign`, `text` | — | text = children or `text` |
| `puredashboard-space` | `direction`, `size`, `align`, `justify`, `wrap` | — | flex gap container; children stay flex items |
| `puredashboard-flex` | `vertical`, `justify`, `align`, `wrap`, `gap` | — | thin flexbox wrapper; children stay flex items |
| `puredashboard-row` / `puredashboard-col` | row: `gutter`,`align`,`justify` · col: `span`(1-24),`offset`,`xs/sm/md/lg/xl` | — | 24-column grid |
| `puredashboard-layout` + `-header`/`-sider`/`-content`/`-footer` | sider: `width`, `collapsedWidth`, `collapsible`, `collapsed`, `breakpoint` | sider `collapse`{collapsed} | page scaffold; auto side-by-side when a `-sider` is present; sider self-adds a collapse trigger |
| `puredashboard-splitter` | `vertical`, `minSize`, `gutterSize` | `resize`{sizes} | adopts direct children as panels; drag gutters between them |
| `puredashboard-titlebar` | `platform`(mac/windows/linux), `title`, `controls`, `maximized` | `minimize`, `maximizetoggle`, `close` (bubble+composed) | custom titlebar for frameless Tauri/Wails/Electron; whole bar is an OS drag region; slot children via `data-titlebar-leading`/`-center`/`-trailing` |
| `puredashboard-segmented` | `options`, `value`, `size`, `block`, `disabled` | `change`{value} | single-select button group |
| `puredashboard-toggle` | `pressed`, `disabled`, `value`, `label`, `icon`, `size`, `variant`(default/text) | `change`{pressed,value} | two-state BUTTON (`aria-pressed`) that applies immediately — not a form field (use `switch`/`checkbox` for that); icon-only needs `aria-label` |
| `puredashboard-toggle-group` | `value`(string \| string[]), `multiple`, `disabled`, `orientation`, `loop`, `deselectable`, `attached` | `change`{value} | wraps `<puredashboard-toggle>` CHILDREN (light DOM) and owns their selection; one tab stop + arrow keys; children's own `change` is swallowed |

### Form (all form-associated: submit + validity via `name`)
| Tag | Key props | Events | Notes |
|---|---|---|---|
| `puredashboard-input` | `value`, `type`, `placeholder`, `size`, `required`, `disabled`, `readonly`, `error` | native `input`/`change` | wraps `<input>` |
| `puredashboard-textarea` | `value`, `rows`, `autoGrow`, `size`, `error` | native `input`/`change` | |
| `puredashboard-number` | `value`, `min`, `max`, `step`, `size`, `error` | native `input`/`change` | ± steppers |
| `puredashboard-select` | `options`([{value,label}]|string[]), `value`, `placeholder`, `size` | native `change` | wraps `<select>` |
| `puredashboard-combobox` | `options`, `value`, `placeholder`, `allowCustom` | `change`{value} | searchable (APG combobox) |
| `puredashboard-checkbox` | `checked`, `indeterminate`, `value`, `label`, `required` | native `change` | |
| `puredashboard-switch` | `checked`, `value`, `label` | native `change` | role=switch |
| `puredashboard-radio-group` | `options`, `value`, `name`, `required` | `change`{value} | APG radio group |
| `puredashboard-slider` | `value`, `min`, `max`, `step`, `showValue` | native `input`/`change` | wraps `<input type=range>` |
| `puredashboard-date` / `puredashboard-time` | `value`, `min`, `max`, `step`(time) | native `input`/`change` | wrap native pickers |
| `puredashboard-color` | `value`(hex), `showValue` | native `input`/`change` | swatch |
| `puredashboard-rate` | `value`, `count`, `allowHalf`, `allowClear` | `change`{value} | star rating (role=slider) |
| `puredashboard-form` | `noValidate` | `submit`{values,formData,valid}, `invalid`, `reset` | wraps children in a real `<form>` |
| `puredashboard-upload` | `accept`, `multiple`, `maxSize`; method `upload(url)` | `files`, `uploadprogress`, `uploaddone`, … | drag-drop, multipart |

### Navigation
| Tag | Key props | Events | Notes |
|---|---|---|---|
| `puredashboard-tabs` | `tabs`([{id,label,disabled,panelId}]), `value` | `tabchange`{value} | APG tabs; toggles `panelId` elements |
| `puredashboard-breadcrumb` | `items`([{label,href}]), `maxItems` | — | last = current; real `<a>` |
| `puredashboard-pagination` | `page`, `total`+`pageSize` \| `pageCount`, `siblingCount` | `pagechange`{page} | windowed + ellipsis |
| `puredashboard-steps` | `steps`, `current`(0-based), `vertical`, `clickable` | `stepchange`{index} | |
| `puredashboard-nav` | `items`(tree {label,href,icon,children}), `current` | `toggle` | sidebar; real `<a>`, collapsible groups |
| `puredashboard-menubar` | `menus`([{label,items,icon,disabled}]), `orientation`, `disabled`, `openIndex`; methods `open(i)`/`close()` | `select`{value,menu,index}, `openchange`{open,index} | desktop app menu bar (File · Edit · View); each dropdown is a full `menu()` (icons, shortcuts, groups, checkbox/radio, submenus); APG menubar keyboard + hover-to-switch |

### Data display
| Tag | Key props | Events | Notes |
|---|---|---|---|
| `puredashboard-table` | `columns`, `rows`, `rowKey`, `selectable`, `actions`, `bulkActions`, `pageSize`, `getHref` | `action`{name,row}, `bulkaction`, `selectionchange` | sort/filter/paginate; `column.render(row)` may return a DOM node |
| `puredashboard-card` | `title`, `bordered` | — | body = children; `data-card-footer`/`-extra` children project |
| `puredashboard-descriptions` | `items`([{label,value,span}]), `columns`, `bordered`, `title` | — | dl/dt/dd |
| `puredashboard-statistic` | `title`, `value`, `precision`, `prefix`, `suffix`, `trend`(up/down) | — | formats numbers |
| `puredashboard-tag` | `color`, `size`, `round`, `closable` | `close`(cancelable) | text = children |
| `puredashboard-badge` | `count`, `max`, `dot`, `showZero`, `color`, `standalone` | — | wraps the badged child |
| `puredashboard-avatar` | `src`, `name`, `size`, `shape`, `color` | — | image → initials fallback |
| `puredashboard-list` | `items`([{title,description,extra}]), `header`, `footer`, `bordered`, `loading` | — | |
| `puredashboard-tree` | `nodes`(hierarchical), `selectedKey`, `expandedKeys` | `select`{key,node}, `toggle` | APG tree |
| `puredashboard-collapse` | `items`([{key,header,content}]), `value`, `multiple` | `change`{value} | APG accordion |
| `puredashboard-timeline` | `items`([{label,content,color,dot}]), `mode`(left/right/alternate), `pending` | — | |
| `puredashboard-empty` | `description`, `compact` | — | actions = children |
| `puredashboard-result` | `status`(success/error/info/warning/404/403/500), `title`, `subtitle` | — | actions = children |
| `puredashboard-markdown` | `value` | — | XSS-safe (textContent only). Inline children are taken as the source ONCE, on first connect — after that set `.value`. Only a source change repaints, so moving it (a keyed `repeat()` reorder, a drag-drop) costs no re-parse. Bind it as `.value=${x}`, never by interpolating a child — a child `${}` is unsupported and renders stale |
| `puredashboard-json-view` | `data`(value or JSON string), `theme`(auto + 10 built-in palettes e.g. github-dark/dracula/nord, or a custom mode), `themes`(per-mode palette override), `level`(initial expand depth: 0=all closed, 1=root's fields, …), `copyable` | — | collapsible syntax-highlighted JSON tree; OS-aware; per-value copy (reads textContent on click, keeps escapes) |
| `puredashboard-lazy` | `trigger`(visible/idle/eager/manual), `rootMargin`, `height`, `unrender`; props `render(host)` / `load()`; methods `renderNow()`/`reset()` | `render`{reason}, `loaderror`{error}, `unrender` | defers building expensive content (json-view, markdown, tables) until it scrolls into view; `<template>` child = zero-JS, `[data-lazy-fallback]` child = your own placeholder |

### Overlay (wrap a trigger child)
| Tag | Key props | Events | Notes |
|---|---|---|---|
| `puredashboard-tooltip` | `text`, `placement`, `delay` | — | shows on hover/focus |
| `puredashboard-popover` | `placement`, `open`; methods `show/hide/toggle` | `open`, `close` | trigger + `[data-popover-content]`; top layer |
| `puredashboard-popconfirm` | `title`, `description`, `okDanger`, `placement` | `confirm`, `cancel` | you perform the action on `confirm` |

### Feedback
| Tag | Key props | Events | Notes |
|---|---|---|---|
| `puredashboard-alert` | `type`, `title`, `message`, `showIcon`, `closable` | `close`(cancelable) | inline banner |
| `puredashboard-progress` | `value`, `max`, `variant`(line/circle), `status`, `showInfo`, `indeterminate` | — | |
| `puredashboard-meter` | `value`, `min`, `max`, `low`/`high`/`optimum`, `label`, `showValue`, `format`(Intl opts), `locale`, `size` | — | `role=meter` gauge for a READING in a range (disk/quota/score) — not a task's progress; low/high/optimum give the native `<meter>` green/amber/red zones |
| `puredashboard-spinner` | `size`, `label`, `labelVisible`, `inline` | — | role=status |
| `puredashboard-skeleton` | `variant`(text/rect/circle), `lines`, `width`, `height`, `animated` | — | loading placeholder |

Imperative (not elements): `dialog`, `drawer`, `alert`, `confirm`, `prompt`
(`dialog.js`); `menu` (`menu.js`); `toast` (`toast.js`).

---

## Invariants — do NOT break these when extending

- **No runtime dependency, no build step, no `eval`/`new Function`.** `src/*` ships as-is.
- Untrusted content reaches the DOM only via `textContent` / `<puredashboard-markdown>`.
- **Trust boundary.** Component props are TRUSTED author config: `raw()`/`icon`/`render`
  slots and any `*.icon` field are inserted as markup — never feed them untrusted data.
  `href`/`src` bound through the engine (and `menu()`) are scheme-guarded
  (`javascript:`/`vbscript:`/`data:` are dropped), but treat URLs from users/tenants as
  untrusted and validate them yourself. Upload `accept`/`maxSize` are UX hints only —
  the server must validate.
- BEM class names (`.puredashboard-<tag>__el--mod`); script hooks are separate
  `js-…`/`data-*` — never style those. All UI strings live in a `LABELS` map,
  overridable via the `labels` property.
- Theme via the `--pd-* ← --app-token ← system-color` custom-property chain.

Deeper docs: `docs/ARCHITECTURE.md` (how it works), `docs/USAGE.md` (embedding, CSP,
theming), `docs/DEVELOPMENT.md` (add a component). Preview everything: serve the repo
and open `test/gallery.html`.
