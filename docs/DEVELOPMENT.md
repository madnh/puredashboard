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

### 7. Theming via CSS custom properties (three token tiers)

- Each component's CSS resolves colours through a `--pd-*` chain on its root:
  `var(--pd-accent)` ← `var(--accent, …)` ← a neutral **system-colour** default
  (`Canvas`/`CanvasText`/`color-mix`). So a component looks right with **no config**,
  adapts to light/dark, **themes** when the app defines its tokens, and can be
  **overridden** via `--pd-*`. Theme by setting tokens — never by overriding the rules.
- The token system has **three tiers** (see `src/theme/tokens.css`):
  1. **Primitive** `--pd-ref-*` — the raw, mode-independent colour ramp. Lives only in
     `tokens.css`; components never read it directly.
  2. **Semantic** — the app tokens a component actually consumes: colour (`--accent`,
     `--panel`, `--text`, `--danger-bg`, …), `--focus-ring`, `--shadow-1..3`,
     `--radius*`, `--sp-*`, typography (`--font-size-*`, `--weight-*`), control sizing
     (`--control-height-*`, `--control-pad-x`, `--disabled-opacity`), `--z-*`, and
     motion (`--duration-*`, `--ease-*`). This is the public theming contract — reuse
     these instead of inventing new literals.
  3. **Component** `--pd-<tag-suffix>-*` — per-component knobs declared **inside** that
     component's own stylesheet root (e.g. `--pd-table-*`, `--pd-dialog-*`), each with
     the fallback chain above. Never add component tokens to `tokens.css`.
- **Reuse the shared semantic tokens.** Use `--focus-ring` for focus outlines,
  `--control-height-md` for input/button height, `--duration-fast var(--ease-standard)`
  for transitions, `--danger-bg`/`--danger-border` for destructive affordances,
  `--shadow-*` for elevation — so every component is consistent and re-themes at once.
- Respect `prefers-reduced-motion` (the motion tokens already collapse to `0ms`) and the
  optional `[data-density="compact"]` sizing override for free by using the tokens.

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
- For anything native can't provide (combobox, listbox, tabs, tree, slider), follow the
  **[WAI-ARIA Authoring Practices (APG)](https://www.w3.org/WAI/ARIA/apg/patterns/)**
  pattern for that widget — its roles, states, and full keyboard map are the spec we
  build to. Test keyboard-only.

### 10. Form-associated custom elements

- A custom element that acts as a **form input** must participate in `<form>` natively —
  don't reinvent submission/validation. Use `static formAssociated = true` +
  `this.#internals = this.attachInternals()`; push the value with
  `this.#internals.setFormValue(v)` and validity with
  `this.#internals.setValidity({...}, message, anchorEl)`. This is native, zero-dependency
  and CSP-safe. `<puredashboard-upload>` already does this (native multipart submit); every
  new input control (`input`, `select`, `checkbox`, `switch`, `slider`, …) follows suit.
- Reflect `disabled`/`required`/`name`/`value` as properties **and** attributes, and honour
  `formDisabledCallback`. Keep the controlled/uncontrolled story consistent across controls.

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
5. Ship a **co-located** `src/<name>.css` themed through `--pd-*` tokens (default to the
   semantic app tokens, then to system colours) so the component is self-contained.
   Reuse the shared tokens (`--focus-ring`, `--control-height-*`, `--shadow-*`,
   `--duration-*`, `--danger-bg`, …) rather than new literals; declare any per-component
   knobs as `--pd-<name>-*` on the component root.
6. If it's a form input, make it **form-associated** (`static formAssociated = true` +
   `attachInternals()`, see rule 10) so it submits and validates natively.
7. Document the public API as **JSDoc** above the class (`@element @prop @fires @method
   @cssprop @example`).
8. **Register the stylesheet** in `src/components.css` (`@import "<name>.css";`) so the
   one-link bundle stays complete.
9. Add a jsdom test in `test/<name>.test.mjs`; verify focus / top-layer / drag / keyboard
   in a real browser when relevant (drop a `test/<name>-harness.html` page) and add the
   component to `test/showcase.html`.

### Definition of Done

A component is finished only when **all** hold — this is the checklist that keeps a large
set uniform and safe:

- [ ] Right family (Reactive / imperative overlay / pure-DOM) — didn't force a base.
- [ ] State in `static properties`; all strings in a `LABELS` map + one `labels` prop.
- [ ] BEM CSS, block = tag; script hooks are separate `js-`/`data-*`, never styled.
- [ ] Themed via the token chain; shared semantic tokens reused; component knobs are
      `--pd-<name>-*`; works with **no** theme linked (system-colour fallbacks).
- [ ] A11y per native elements or the WAI-ARIA APG pattern; full keyboard; `aria-*` set;
      honours reduced-motion and compact density through the tokens.
- [ ] Form inputs are form-associated (`ElementInternals`): value + validity + disabled.
- [ ] CSP-safe: no `eval`/`new Function`; untrusted content reaches the DOM only via
      `textContent` (never `innerHTML`/`html\`\``).
- [ ] JSDoc on the public API (`@prop`/`@attr`/`@fires`/`@example` — the analyzer tags),
      then regenerate the agent reference: `make -C test/cem` → `src/_components.jsonl`.
- [ ] jsdom test in `test/<name>.test.mjs`; entry in `test/showcase.html`; `@import` added
      to `src/components.css`.
- [ ] `make -C test` is green.

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
