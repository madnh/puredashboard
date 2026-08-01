// <puredashboard-lazy> — render expensive content only when it is actually needed.
// Zero-dep, no build, CSP-safe. Extends plain HTMLElement (NOT Reactive): its whole job
// is to hold the author's light-DOM children — a <template> and an optional placeholder —
// and a Reactive render() would blow them away (same reason splitter.js adopts children).
//
// WHY: a page with 50 <puredashboard-json-view>s, <puredashboard-markdown>s, tables or
// charts pays for all 50 up front — parsing, custom-element upgrades, layout — even
// though the user sees three. Wrapping each in a lazy defers that work until the element
// scrolls into view (image `loading="lazy"`, but for components).
//
//   <puredashboard-lazy>
//     <template>                            <!-- inert: never parsed into live DOM … -->
//       <puredashboard-json-view></puredashboard-json-view>   <!-- … not even upgraded -->
//     </template>
//   </puredashboard-lazy>
//
// That's the whole API for the common case. A <template>'s content is an inert document
// fragment: custom elements inside it are NOT upgraded and their scripts/styles never
// run, so the deferral is real, not just visual.
//
// NOT the same as CSS `content-visibility: auto`, which skips LAYOUT AND PAINT of
// off-screen content but still builds every node and upgrades every component. Use
// content-visibility for cheap-to-build/expensive-to-lay-out content, and this for
// expensive-to-BUILD content. They compose fine.
//
// Three ways to supply the content, in priority order:
//   1. a <template> child            — markup, deferred by the platform
//   2. `render` — (host) => Node | DocumentFragment | void | Promise<…>
//   3. `load`   — () => import("./heavy.js"), whose default export is a TAG NAME or a
//      mount function (host) => cleanup? — the same contract as router.js pages, so a
//      module can be used by either.
//
// While waiting it shows a placeholder: the author's own `[data-lazy-fallback]` child if
// there is one, else a built-in shimmer block whose height is reserved (`height`) so
// nothing jumps when the real content lands.
//
// Class naming (BEM, block = the component tag); the script's hooks are `data-*`
// attributes. Themed through the shared tokens via a --pd-* chain. All fixed strings live
// in a LABELS map. See docs/DEVELOPMENT.md → "Definition of Done".

// All FIXED user-facing strings (English defaults), overridable per instance via the
// `labels` property — e.g. lz.labels = { loading: "Đang tải…" }.
const LABELS = {
  // Announced by the placeholder while the real content is still pending.
  loading: "Loading…",
};

// Every lazy element that has not rendered yet. Printing (or a Ctrl+F that must find
// text) needs the whole page materialised, so one shared `beforeprint` listener renders
// them all — cheaper than a listener per instance.
const PENDING = new Set();
let printHooked = false;
function hookPrint() {
  if (printHooked || typeof window === "undefined" || !window.addEventListener) return;
  printHooked = true;
  window.addEventListener("beforeprint", () => { for (const el of [...PENDING]) el.renderNow("print"); });
}

const idle = (fn) =>
  typeof requestIdleCallback === "function" ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 1);

/**
 * Defer building expensive content until it is needed — the component equivalent of
 * `<img loading="lazy">`. Put the heavy markup in a `<template>` child (a template's
 * content is inert: custom elements inside it are never upgraded), and the lazy element
 * clones it in when it scrolls into view, showing a placeholder until then.
 *
 * Use it around anything that costs real work per instance — `<puredashboard-json-view>`,
 * `<puredashboard-markdown>`, a table, a chart — when a page holds many of them.
 *
 * Unlike CSS `content-visibility: auto` (which skips layout/paint but still builds the
 * DOM), this skips the construction itself.
 *
 * @element puredashboard-lazy
 *
 * @prop {string}   trigger    - When to render: `"visible"` (default, an `IntersectionObserver`), `"idle"` (`requestIdleCallback`), `"eager"` (next frame — useful to keep the API while opting out), or `"manual"` (only `renderNow()`).
 * @prop {string}   rootMargin - Margin around the viewport for the `"visible"` trigger, e.g. `"400px"` to render just before it scrolls in. Default `"200px"`.
 * @prop {Function} render     - `(host) => Node | DocumentFragment | void | Promise<…>` — build the content in JS. Return a node (it is appended) or append to `host` yourself.
 * @prop {Function} load       - `() => Promise<module>` — a dynamic `import()`. The module's default export is a tag name (string) or a mount function `(host) => cleanup?`, the same contract as `router.js` pages.
 * @prop {string}   height     - CSS height reserved for the placeholder so the page doesn't jump, e.g. `"180px"`. Default `--pd-lazy-min-h` (64px).
 * @prop {boolean}  unrender   - Tear the content down again when it scrolls far out of view (and re-render on return), keeping the last measured height. For very long lists where retained DOM is the problem. Default `false`.
 * @prop {Object}   labels     - Override UI strings. Keys: `loading`. Unset keys keep the English default.
 *
 * @attr {string}  trigger     - Declarative form of `trigger`.
 * @attr {string}  root-margin - Declarative form of `rootMargin`.
 * @attr {string}  height      - Declarative form of `height`.
 * @attr {boolean} unrender    - Declarative form of `unrender`.
 * @attr {string}  data-state  - Reflected state: `pending` | `rendering` | `rendered` | `error`. Style or query it; never set it yourself.
 *
 * @fires render - Bubbling `CustomEvent` after the content is in the DOM. `detail` = `{ reason }` (`"visible"`, `"idle"`, `"eager"`, `"manual"`, `"print"`).
 * @fires loaderror - Bubbling `CustomEvent` when `load()`/`render()` throws or rejects. `detail` = `{ error }`. The placeholder stays and `data-state="error"`. (Named `loaderror`, not `error`: a bubbling `error` event would reach every `window.addEventListener("error")` monitor as a nameless page error.)
 * @fires unrender - Bubbling `CustomEvent` after `unrender` tore the content down again.
 *
 * @method renderNow - `renderNow(reason?) => Promise<void>` — render immediately, whatever the trigger.
 * @method reset - `reset() => void` — drop the content and go back to the placeholder (re-arms the trigger).
 *
 * @cssprop [--pd-lazy-min-h] - Reserved placeholder height when `height` is unset (defaults to `64px`).
 *
 * @example
 * // 1. markup in a <template> — the common case, no JS at all
 * // <puredashboard-lazy height="200px">
 * //   <template><puredashboard-json-view></puredashboard-json-view></template>
 * //   <puredashboard-skeleton data-lazy-fallback lines="3"></puredashboard-skeleton>
 * // </puredashboard-lazy>
 *
 * // 2. build it in JS, with the row's data
 * const lz = document.createElement("puredashboard-lazy");
 * lz.height = "240px";
 * lz.render = (host) => { const v = document.createElement("puredashboard-json-view"); v.data = row; return v; };
 * lz.addEventListener("render", () => console.log("built"));
 *
 * // 3. defer the MODULE too (same contract as a router page)
 * lz.load = () => import("./heavy-chart.js");
 */
class PuredashboardLazy extends HTMLElement {
  static get observedAttributes() { return ["trigger", "root-margin", "height", "unrender"]; }

  constructor() {
    super();
    this._state = "pending";
    this._inited = false;
    this._cleanup = null;      // teardown returned by a mount function
    this._io = null;
    this._idleId = 0;
    this._lastHeight = "";     // remembered so an unrender/re-render doesn't jump
    for (const p of ["trigger", "rootMargin", "render", "load", "height", "unrender", "labels"]) this._upgrade(p);
  }
  _upgrade(p) {
    if (Object.prototype.hasOwnProperty.call(this, p)) { const v = this[p]; delete this[p]; this[p] = v; }
  }

  // ---- reflected properties ---------------------------------------------------------
  get trigger() { return this.getAttribute("trigger") || "visible"; }
  set trigger(v) { v == null ? this.removeAttribute("trigger") : this.setAttribute("trigger", v); }
  get rootMargin() { return this.getAttribute("root-margin") || "200px"; }
  set rootMargin(v) { v == null ? this.removeAttribute("root-margin") : this.setAttribute("root-margin", v); }
  get height() { return this.getAttribute("height") || ""; }
  set height(v) { v == null ? this.removeAttribute("height") : this.setAttribute("height", v); }
  get unrender() { return this.hasAttribute("unrender"); }
  set unrender(v) { if (v) this.setAttribute("unrender", ""); else this.removeAttribute("unrender"); }
  /** Current state: `pending` | `rendering` | `rendered` | `error` (read-only). */
  get state() { return this._state; }

  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  attributeChangedCallback(name) {
    if (!this._inited) return;
    if (name === "height") this._applyHeight();
    else if (this._state === "pending") this._arm();       // re-arm on a trigger change
  }

  connectedCallback() {
    if (!this._inited) {
      this._inited = true;
      this.classList.add("puredashboard-lazy");
      hookPrint();
      this._placeholder();
    }
    if (this._state === "pending") this._arm();
  }
  disconnectedCallback() { this._disarm(); PENDING.delete(this); }

  // ---- placeholder ------------------------------------------------------------------
  // The author's own `[data-lazy-fallback]` child wins; otherwise a built-in shimmer
  // block. Either way the host keeps a reserved height so the page doesn't jump when the
  // real content lands.
  _placeholder() {
    this._setState("pending");
    PENDING.add(this);
    const own = this.querySelector(":scope > [data-lazy-fallback]");
    if (own) { own.hidden = false; this._own = own; }
    else if (!this._ph) {
      const ph = document.createElement("div");
      ph.className = "puredashboard-lazy__placeholder";
      ph.setAttribute("data-lazy-placeholder", "");
      ph.setAttribute("aria-hidden", "true");           // decorative; the host announces the wait
      this._ph = ph;
      this.appendChild(ph);
    } else if (!this._ph.isConnected) this.appendChild(this._ph);
    this.setAttribute("aria-busy", "true");
    if (!this.hasAttribute("aria-label") && !this.hasAttribute("aria-labelledby")) {
      // Only OUR fallback label is ever written or removed — never an author's.
      const name = this._label("loading");
      if (this.getAttribute("aria-label") !== name) { this._ariaOwn = name; this.setAttribute("aria-label", name); }
    }
    this._applyHeight();
  }

  _applyHeight() {
    const h = this.height || this._lastHeight;
    if (h) this.style.setProperty("--pd-lazy-h", h);
    else this.style.removeProperty("--pd-lazy-h");
  }

  _dropPlaceholder() {
    if (this._own) { this._own.hidden = true; }
    if (this._ph && this._ph.isConnected) this._ph.remove();
    this.removeAttribute("aria-busy");
    if (this._ariaOwn && this.getAttribute("aria-label") === this._ariaOwn) { this.removeAttribute("aria-label"); this._ariaOwn = null; }
    this.style.removeProperty("--pd-lazy-h");
  }

  _setState(s) { this._state = s; this.setAttribute("data-state", s); }

  // ---- triggers ---------------------------------------------------------------------
  _arm() {
    this._disarm();
    const t = this.trigger;
    if (t === "manual") return;
    if (t === "eager") { this._raf = requestAnimationFrame(() => this.renderNow("eager")); return; }
    if (t === "idle") { this._idleId = idle(() => this.renderNow("idle")); return; }
    // "visible" — and, where IntersectionObserver is missing (very old engines, jsdom),
    // degrade to rendering right away rather than never showing the content at all.
    if (typeof IntersectionObserver !== "function") { this.renderNow("eager"); return; }
    this._io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) this.renderNow("visible");
        else if (this.unrender && this._state === "rendered") this.reset();
      }
    }, { rootMargin: this.rootMargin, threshold: 0 });
    this._io.observe(this);
  }
  _disarm() {
    if (this._io) { this._io.disconnect(); this._io = null; }
    if (this._idleId) { (typeof cancelIdleCallback === "function" ? cancelIdleCallback : clearTimeout)(this._idleId); this._idleId = 0; }
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = 0; }
  }

  // ---- rendering --------------------------------------------------------------------
  /** Render immediately, whatever the trigger says. Safe to call twice. */
  async renderNow(reason = "manual") {
    if (this._state === "rendering" || this._state === "rendered") return;
    this._setState("rendering");
    PENDING.delete(this);
    // Keep observing while `unrender` is on (it needs the leave events); otherwise the
    // work is done once and the observer is pure overhead.
    if (!this.unrender) this._disarm();
    try {
      const node = await this._build();
      this._dropPlaceholder();
      if (node) this.appendChild(node);
      this._setState("rendered");
      this.dispatchEvent(new CustomEvent("render", { detail: { reason }, bubbles: true }));
    } catch (error) {
      this._setState("error");
      PENDING.delete(this);
      // NOT "error": that name bubbles into window error monitors (Sentry & co) as a page error.
      this.dispatchEvent(new CustomEvent("loaderror", { detail: { error }, bubbles: true }));
    }
  }

  // Build the content from whichever source the author gave. A <template> wins because
  // it is the zero-JS path; `render` and `load` are the programmatic ones.
  async _build() {
    const tpl = this.querySelector(":scope > template");
    if (tpl) return tpl.content.cloneNode(true);
    if (typeof this.render === "function") {
      const out = await this.render(this);
      return out && out.nodeType ? out : null;          // a returned node is appended; else it appended itself
    }
    if (typeof this.load === "function") {
      const mod = await this.load();
      const page = mod && mod.default;
      if (typeof page === "string") return document.createElement(page);   // a tag name
      if (typeof page === "function") {                                    // a mount function
        this._dropPlaceholder();
        const ret = page(this);
        if (typeof ret === "function") this._cleanup = ret;
        return null;
      }
    }
    return null;
  }

  /** Drop the content and go back to the placeholder — re-arming the trigger. */
  reset() {
    if (this._cleanup) { try { this._cleanup(); } catch { /* the author's teardown threw; keep going */ } this._cleanup = null; }
    // Remember the height the content had, so swapping back to the placeholder (and the
    // eventual re-render) doesn't move the page under the user.
    if (this._state === "rendered" && !this.height) {
      const h = this.offsetHeight;
      if (h) this._lastHeight = `${h}px`;
    }
    const keep = new Set([this._ph, this._own]);
    for (const n of [...this.childNodes]) {
      if (keep.has(n) || (n.nodeType === 1 && n.localName === "template")) continue;
      n.remove();
    }
    const was = this._state;
    this._placeholder();
    if (was === "rendered") this.dispatchEvent(new CustomEvent("unrender", { detail: {}, bubbles: true }));
    if (this.isConnected) this._arm();
  }
}
customElements.define("puredashboard-lazy", PuredashboardLazy);

export { PuredashboardLazy };
