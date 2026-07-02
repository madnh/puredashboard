# PureDashboard — guide for AI agents

> You're reading this because you're wiring PureDashboard into an app. It exists so
> you **don't have to read the component source** to use it. Everything you need —
> the rules, the copy-paste recipes, and a full component index — is here. For the
> exhaustive machine-readable API, see **`_custom-elements.json`** (Custom Elements
> Manifest) next to this file.
>
> This file ships inside `src/` (as `_agents.md`), so it travels when someone copies
> the folder. It is skipped by the `//go:embed` walker (leading `_`), so it never
> bloats a backend binary.

## What this is

A vanilla, **zero-dependency, no-build, CSP-safe** UI component library: ~44 custom
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

## Which `html` tag? (only relevant if you EXTEND the library)

Two tagged templates exist. As a **consumer you rarely need either** — you set
properties. If you author a component: `reactive.js` `html` (diffs the DOM in place,
for input-bearing elements) vs `html.js` `html` (one-shot string→innerHTML, escaped).
See `docs/DEVELOPMENT.md`.

## Three component families

1. **Reactive custom elements** — most components. Configure via JS properties;
   they re-render. Form inputs are **form-associated** (submit + validate natively).
2. **Imperative overlays** — `dialog`/`drawer`/`alert`/`confirm`/`prompt`, `menu`,
   `toast`. Plain functions you *call and await*; they show in the top layer.
3. **Pure-DOM** — `<puredashboard-markdown>` (XSS-safe, `textContent` only).

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
  { label: "Edit", value: "edit", icon: SVG_STRING },
  { separator: true },
  { label: "Delete", value: "delete", danger: true },
]);                                              // → chosen value | null
```
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
strings are overridable via the `labels` property on every component. Full API +
CSS custom props: `_custom-elements.json`.

### General & layout
| Tag | Key props | Events | Notes |
|---|---|---|---|
| `puredashboard-button` | `variant`(primary/default/dashed/text/link), `size`, `danger`, `loading`, `block`, `href`, `type`, `icon` | native `click` | label = children; renders `<a>` when `href` set |
| `puredashboard-divider` | `orientation`, `dashed`, `textAlign`, `text` | — | text = children or `text` |
| `puredashboard-space` | `direction`, `size`, `align`, `justify`, `wrap` | — | flex gap container; children stay flex items |
| `puredashboard-row` / `puredashboard-col` | row: `gutter`,`align`,`justify` · col: `span`(1-24),`offset`,`xs/sm/md/lg/xl` | — | 24-column grid |
| `puredashboard-segmented` | `options`, `value`, `size`, `block`, `disabled` | `change`{value} | single-select button group |

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
| `puredashboard-markdown` | `value` | — | XSS-safe (textContent only) |

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
| `puredashboard-spinner` | `size`, `label`, `labelVisible`, `inline` | — | role=status |
| `puredashboard-skeleton` | `variant`(text/rect/circle), `lines`, `width`, `height`, `animated` | — | loading placeholder |

Imperative (not elements): `dialog`, `drawer`, `alert`, `confirm`, `prompt`
(`dialog.js`); `menu` (`menu.js`); `toast` (`toast.js`).

---

## Invariants — do NOT break these when extending

- **No runtime dependency, no build step, no `eval`/`new Function`.** `src/*` ships as-is.
- Untrusted content reaches the DOM only via `textContent` / `<puredashboard-markdown>`.
- BEM class names (`.puredashboard-<tag>__el--mod`); script hooks are separate
  `js-…`/`data-*` — never style those. All UI strings live in a `LABELS` map,
  overridable via the `labels` property.
- Theme via the `--pd-* ← --app-token ← system-color` custom-property chain.

Deeper docs: `docs/ARCHITECTURE.md` (how it works), `docs/USAGE.md` (embedding, CSP,
theming), `docs/DEVELOPMENT.md` (add a component). Preview everything: serve the repo
and open `test/gallery.html`.
