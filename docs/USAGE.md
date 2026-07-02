# Usage

How to consume PureDashboard in an app. For *how it works internally* see
[ARCHITECTURE.md](ARCHITECTURE.md); for *how to extend it* see
[DEVELOPMENT.md](DEVELOPMENT.md).

- [Drop-in](#drop-in)
- [Embedding in a backend (Go)](#embedding-in-a-backend-go)
- [Composing components](#composing-components)
- [Theming](#theming)
- [Per-component API](#per-component-api)

---

## Drop-in

Put the `src/` folder anywhere and name it anything — every internal import is
**relative**, so there's no base path to configure. To use it: (1) `import` the JS
modules from wherever you dropped them, and (2) link the CSS of the components you use.
Each component's CSS is self-contained and themes itself with zero configuration.

```html
<link rel="stylesheet" href="LIB/table.css">
<link rel="stylesheet" href="LIB/menu.css">
<link rel="stylesheet" href="LIB/upload.css">
<link rel="stylesheet" href="LIB/dialog.css">
<link rel="stylesheet" href="LIB/toast.css">
<script type="module">
  import { toast }   from "./LIB/toast.js";
  import { confirm } from "./LIB/dialog.js";
  import { menu }    from "./LIB/menu.js";
  import "./LIB/table.js";    // defines <puredashboard-table>
  import "./LIB/upload.js";   // defines <puredashboard-upload>

  const t = document.createElement("puredashboard-table");
  t.columns = [{ key: "name", label: "Name", sortable: true }];
  t.rows    = nodes;
  t.rowKey  = (r) => r.name;
  t.selectable  = true;
  t.bulkActions = [{ name: "delete", label: "Delete", danger: true }];
  t.addEventListener("bulkaction", async (e) => {
    if (await confirm(`Delete ${e.detail.rows.length} rows?`)) { /* … */ toast.success("Deleted"); }
  });
  document.body.append(t);
</script>
```

Replace `LIB/` with wherever you dropped the folder.

---

## Embedding in a backend (Go)

Because there's **no build step**, `src/` *is* the shippable artifact: plain `.js` and
`.css` a browser loads directly. Any server can serve them statically; a backend can
**embed the whole UI into its binary** and serve it from `/`, with no Node toolchain in
the build. This is the headline use case PureDashboard is designed for.

**1. Vendor `src/` into your web assets** (rename the folder however you like):

```
yourapp/
├─ main.go
└─ web/
   ├─ index.html
   └─ vendor/puredashboard/   ← copy of this repo's src/  (*.js + *.css)
```

**2. Embed and serve with `//go:embed`** — one binary, no separate frontend deploy:

```go
package main

import (
	"embed"
	"net/http"
)

//go:embed all:web
var webFS embed.FS

func main() {
	http.Handle("/", http.FileServerFS(webFS))
	http.ListenAndServe(":8080", nil)
}
```

**3. Reference the modules from `index.html`** (paths relative to where you dropped it):

```html
<link rel="stylesheet" href="/web/vendor/puredashboard/table.css">
<script type="module">
  import "/web/vendor/puredashboard/table.js";   // defines <puredashboard-table>
  import { toast } from "/web/vendor/puredashboard/toast.js";
</script>
```

**Embed only what ships.** `//go:embed` skips files/dirs whose name starts with `_` or
`.`. Keep `test/` and `tools/` out of your `web/` tree (both are dev-only) — or, if you
must colocate them, prefix the folder with `_` (e.g. `_test/`) so the embed walker
ignores it. Same for docs: don't copy this repo's `README.md`/`docs/` into `web/`.

**CSP.** The library compiles templates by cloning `<template>` nodes — no `eval` /
`new Function` — so it runs under a strict `script-src 'self'`. It uses inline
`style="…"` only for *dynamic* values (progress widths, overlay positions), so allow
`'unsafe-inline'` for **styles only**:

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'
```

The same approach applies to any embedding backend (Rust `rust-embed`, Python package
data, a plain static file server) — `src/` is just files.

---

## Composing components

Overlays take their content as a `(body) => …` callback, so you can drop **any**
component inside — `dialog()` / `drawer()` compose with `<puredashboard-table>`,
`<puredashboard-upload>`, `<puredashboard-markdown>`, a plain `<form>`, etc.

```js
import { dialog } from "./LIB/dialog.js";
import "./LIB/upload.js";

dialog({
  title: "Attach files",
  content: (body) => {
    const form = document.createElement("form");
    form.method = "dialog";                       // submit closes the dialog
    const up = document.createElement("puredashboard-upload");
    up.name = "files"; up.multiple = true;
    form.append(up, Object.assign(document.createElement("button"), { type: "submit", textContent: "Upload" }));
    form.addEventListener("submit", () => sendFiles(new FormData(form)));   // files are in the FormData
    body.append(form);
  },
}).show();
```

Set component properties (`.value`, `.rows`, …) before or after `append` — they render
when the dialog connects them to the DOM.

**Lifecycle / leaks.** When a dialog closes it removes its subtree (idempotently, via
both `close()` and the native Esc/backdrop `close` event), so every child's
`disconnectedCallback` runs — e.g. `<puredashboard-upload>` revokes its thumbnail
object-URLs. The overlays add **no global** listeners that outlive them. Two things stay
*your* responsibility: don't keep the returned controller (`const d = dialog(…)`)
referenced longer than needed (it pins the detached DOM), and tear down anything *you*
start inside `content` (a `setInterval`, a global listener, …) in the dialog's `onClose`.

> Stacking caveat: a modal `<dialog>` and a `menu()`/`toast()` popover all live in the
> top layer. Content *inside* a dialog is fine; opening one top-layer overlay from
> within another (e.g. `menu()` inside a modal) can have ordering quirks — verify it.

---

## Theming

### Option A — use the shipped theme (`src/theme/`)

The fastest path to a cohesive look. Link the all-in-one file and you get the palette,
themed form controls, and the dashboard frame (top bar + page/card layout):

```html
<link rel="stylesheet" href="LIB/theme/dashboard.css">
```

Or take only the pieces you want (`tokens.css` is the only one the components need to
look polished):

```html
<link rel="stylesheet" href="LIB/theme/tokens.css">   <!-- palette (light/dark) -->
<link rel="stylesheet" href="LIB/theme/base.css">     <!-- button / input / code  -->
<link rel="stylesheet" href="LIB/theme/shell.css">    <!-- header + page/card frame -->
```

The theme is **dark by default**, switches to **light** automatically via
`prefers-color-scheme`, and can be **forced** regardless of the OS:

```html
<html data-theme="light"> … </html>   <!-- or data-theme="dark" -->
```

The shell expects a small, documented markup shape (`header > .brand/.tabs/.health`,
`main > .page > .card`) — see the comment at the top of `theme/shell.css`.

### Option B — bring your own tokens

You don't have to use the theme at all. Every component reads your app's design tokens
directly, so you can override from your own stylesheet. Three levels, easiest first
(examples use `md.css`, but the same applies to every component):

**1. Define your app's design tokens.** Every component reads `--accent`, `--panel`,
`--border`, … (with fallbacks). Set them once → everything themes together:

```css
:root { --accent: #e11d48; --panel-2: #f3f4f6; --border: #d1d5db; }
```

**2. Override one component's `--pd-*` tokens** to retheme just it, leaving the rest:

```css
puredashboard-markdown {
  --pd-accent: hotpink;                /* link colour   */
  --pd-mono: "Fira Code", monospace;   /* code font     */
  --pd-panel-2: #fff7ed;               /* code/quote bg */
}
```

**3. Write your own rules** for anything that isn't a token (sizes, spacing, …). Load
your CSS **after** the component's so equal-specificity rules win, or scope to a class:

```css
puredashboard-markdown h1 { font-size: 28px; }
puredashboard-markdown a  { text-decoration: none; }
.chat puredashboard-markdown { font-size: 15px; }   /* only inside .chat */
```

`--pd-x: var(--app-token, fallback)` reads as *"use your `--app-token`; if unset, use
the built-in fallback"* — so it always looks right and themes when you opt in. To start
fully from scratch, just don't link the component's `.css` and style its plain elements.

---

## Per-component API

The **full per-component API** — properties, events, methods, CSS custom properties,
examples — is documented as **JSDoc on each class / function**. Read the source:
`table.js`, `upload.js`, `menu.js`, `dialog.js`, `toast.js`, `router.js`, `md.js`. The
JSDoc uses custom-elements-manifest tags (`@element`, `@prop`, `@fires`, `@method`,
`@cssprop`, `@example`) so editors and AI tools parse it precisely.

The demo harnesses under `test/` (`demo.html`, `*-harness.html`) are runnable examples
of each component.
