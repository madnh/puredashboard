# Development

How to extend and test PureDashboard. Read [ARCHITECTURE.md](ARCHITECTURE.md) first —
it explains the engine and the three component families these rules build on.

```
puredashboard/
├─ src/      ← the library — what ships
│  ├─ *.js   ← ES modules
│  ├─ *.css  ← one self-contained stylesheet per component
│  └─ theme/ ← optional tokens + base + dashboard shell
└─ test/     ← dev-only, never shipped
   ├─ *.test.mjs        ← jsdom logic tests (run via Docker)
   ├─ *.html            ← real-browser demo / harness pages
   └─ Makefile · Dockerfile
```

---

## Design rules

The conventions every module follows. **Follow them when adding or editing a
component** — they're what keep the library coherent, safe, and dependency-free.

### 1. Zero-dependency · no build · CSP-safe

- Plain ES modules and standard DOM only. No npm packages at runtime, no bundler, no
  transpile, no decorators.
- **No `eval` / `new Function`.** The template engine clones `<template>` + walks
  marker nodes (lit's strategy) — never compiles strings to code. Safe under a strict
  `script-src 'self'` CSP.
- Inline `style="…"` attributes are used only for *dynamic* values (progress width,
  overlay position); the host CSP allows `'unsafe-inline'` for **styles only** (not
  scripts).

### 2. Reactive components

- Extend `Reactive`; declare reactive state in `static properties = { … }`. Setting a
  property batches a microtask re-render.
- `render()` returns a `reactive.js` `html\`…\`` result. Wire events with delegation
  (`this.on(type, selector, fn)`) or inline `@event` bindings; emit with
  `this.emit(name, detail)`.
- For keyed lists whose rows hold focus/state, use `repeat(items, keyFn, tmplFn)` —
  a bare `${array.map()}` rebuilds the whole list.
- **When NOT to extend `Reactive`:** only for components whose render is an `html\`…\``
  template. A component that emits **prebuilt DOM** — notably `<puredashboard-markdown>`,
  which builds nodes with `createElement` + `textContent` for XSS-safety — extends plain
  `HTMLElement` with a simple `value` setter. Routing it through `Reactive` would gain
  nothing and its non-`html` return value would hit `renderResult`'s `innerHTML`
  fallback, defeating the textContent-only safety guarantee.
- **Imperative overlays aren't components at all.** `dialog()`, `menu()`, `toast()` are
  plain functions: build a DOM node (`createElement` + `textContent`), show it (native
  `<dialog>` / top-layer popover), and return a controller + a Promise that resolves
  with the result. You *invoke and await* them — so neither `Reactive` nor `html\`\``
  applies. The caller renders its own content into the overlay `body`.

### 3. BEM class names, namespaced by the component tag

- Every **style** class is `block__element--modifier`, where the **block is the
  component tag**: `.puredashboard-upload__zone`, `.puredashboard-table__row--selected`,
  `.puredashboard-menu__item--danger`. This guarantees **no collisions** with app or
  other component styles — users can restyle these freely.

### 4. `js-` prefix for script hooks (never style them)

- Anything the **script** selects is a SEPARATE class with a `js-` prefix
  (`js-puredashboard-table__search`) or a `data-*` attribute (`data-sort`, `data-page`,
  `data-act`, `data-rm`). The script **never** depends on a style class — so a user
  editing the BEM CSS can't break behaviour, and the `js-`/`data-` markers tell them
  what's load-bearing.

### 5. Self-contained icons

- Components **inline their own SVG**, sized via an inline `style` in a tiny local
  `svg()` helper (which wraps `raw()` from `html.js`). No shared icon module, no sprite
  dependency — each component carries exactly the icons it uses. SVGs use
  `overflow:visible` so strokes near the viewBox edge aren't clipped by the UA default.

### 6. Localisation via a single `labels` object

- **All** user-facing strings live in a `LABELS` default map and are overridable via one
  property — `el.labels = { … }`. There is **no** parallel `label`/`text` property (one
  way to do it). Function-valued keys interpolate (`tooLarge: (max) => …`). Unset keys
  keep the English default.

### 7. Theming via CSS custom properties

- Each component's CSS resolves colours through a `--pd-*` chain on its root:
  `var(--pd-accent)` ← `var(--accent, …)` ← a neutral **system-colour** default
  (`Canvas`/`CanvasText`/`color-mix`). So a component looks right with **no config**,
  adapts to light/dark, **themes** when the app defines its tokens, and can be
  **overridden** via `--pd-*`. Theme by setting tokens — never by overriding the rules.

### 8. Communicate via events; opt-in debug

- State changes emit `CustomEvent`s (`selectionchange`, `uploadprogress`, `bulkaction`,
  …) so the surrounding UI can react. A `debug` property `console.debug`s every emit.
- Use real `<a href>` for navigation (open-in-new-tab / keyboard work); reserve JS
  navigation for post-action redirects. Form inputs use form-associated custom elements
  where relevant (`<puredashboard-upload>` submits as native multipart).

### 9. Accessibility & native elements

- Prefer native `<a>`/`<button>`/`<input>`/`<select>`/`<dialog>` for built-in
  behaviour, focus, and a11y. Set `aria-*` (`aria-sort`, `aria-current`, `aria-label`,
  `role`); overlays live in the **top layer** (Popover API / modal `<dialog>`) with
  light-dismiss + Esc.

---

## Adding a new component (recipe)

1. Create `src/<name>.js`. Custom element → `class CompanyXWidget extends Reactive` +
   `CompanyXWidget.define("companyx-widget")`; or an imperative helper (like `menu`) for
   overlays.
2. Import `html`/`repeat` from `./reactive.js`; inline any SVG icons directly in the
   file via a local `svg()` helper.
3. Name style classes `companyx-widget__…` (BEM, block = the tag); select via
   `js-companyx-widget__…` / `data-*` (never style the `js-` ones).
4. Put all strings in a `LABELS` map + a `labels` override property.
5. Ship a **co-located** `src/<name>.css` themed through `--pd-*` tokens (default to app
   tokens, then to system colours) so the component is self-contained.
6. Document the public API as **JSDoc** above the class (`@element @prop @fires @method
   @cssprop @example`).
7. Add a jsdom test in `test/<name>.test.mjs`; verify focus / top-layer / drag in a real
   browser when relevant (drop a `test/<name>-harness.html` page).

---

## Testing

The runtime is zero-dependency, so the test tooling never touches the host — `jsdom`
lives only inside a throwaway Docker image.

- **Logic** — jsdom inside Docker:

  ```sh
  make -C test          # or: cd test && make
  ```

  The image bakes in `jsdom`, mounts the repo read-only, and runs every
  `test/*.test.mjs` as its own process (each sets up its own jsdom), aggregating exit
  codes so any failing suite fails the run. The tests import the engine via
  `../src/*.js` and exercise the real lexer/parts/reconciler against a real DOM — not
  mocks.

- **Real-browser** — open the `test/*.html` harness pages (`demo.html`,
  `dialog-harness.html`, `toast-harness.html`, `focus.html`, …) in a browser for things
  jsdom can't model: top-layer painting, drag-and-drop, focus/caret preservation,
  `@layer` cascade, View Transitions.

When you change `reactive.js`, watch the whitespace-sensitive assertions: the engine
preserves text exactly (like lit-html), so a template written across multiple lines puts
newlines into `textContent`. Keep template text on one line where a test compares it
exactly.
