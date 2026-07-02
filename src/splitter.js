// <puredashboard-splitter> — resizable split panes (Antd-style Splitter).
// Zero-dep, no build, CSP-safe. Extends plain HTMLElement (NOT Reactive) — a
// Reactive render() would blow away the author's light-DOM children, and this
// component's whole job is to PRESERVE those children (they ARE the panels)
// while wrapping the layout around them.
//
// On connect (guarded once) it makes the host a flex container (a row, or a
// column when `vertical`), adopts its direct element children as panels, and
// inserts a draggable GUTTER between each adjacent pair (n panels → n-1
// gutters). Panels are sized with proportional `flex-grow` so the split stays
// responsive: dragging a gutter (pointer events + setPointerCapture) shifts the
// grow ratio between the two ADJACENT panels, clamped to `minSize`. Each gutter
// is a `role="separator"` with the full APG keyboard map (Arrow to nudge, Home/
// End to the extremes) and live `aria-valuenow/min/max`.
//
// Class naming (BEM, block = the component tag): every style class is namespaced
// `puredashboard-splitter__<element>[--<modifier>]`; script hooks are SEPARATE
// `js-…` classes / `data-*` attributes (never restyle or remove those). Themed
// through the shared design tokens (--border, --border-2, --accent, --panel-2,
// --focus-ring, --duration-*) via a --pd-* fallback chain, so it looks right
// with NO theme linked. All user-facing words live in a LABELS map. See
// docs/DEVELOPMENT.md → "Definition of Done".

// All FIXED user-facing strings live here (English defaults). Override any
// subset via the `labels` property — e.g. sp.labels = { resize: "Đổi kích thước" }.
// Function-valued keys interpolate.
const LABELS = {
  // Accessible label for each draggable gutter (a separator).
  resize: "Resize panels",
};

// Keyboard nudge granularity, in percentage points, for Arrow keys.
const STEP = 2;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * A resizable split-pane container. The host's direct element children become
 * the panels; a draggable gutter is inserted between each adjacent pair. Panels
 * are sized as responsive percentages (proportional `flex-grow`), so the layout
 * scales with the container. Drag a gutter with the pointer, or focus it and use
 * the keyboard (Arrow to nudge, Home/End to the min/max). Emits a bubbling
 * `resize` event with the current panel sizes (percentages). Configure via JS
 * properties or declarative attributes.
 *
 * @element puredashboard-splitter
 *
 * @prop {boolean}       vertical   - Stack panels vertically with horizontal gutters. Default `false` (horizontal split, vertical gutters).
 * @prop {string|number} minSize    - Minimum size of any panel, as a `px` number/string or a `"NN%"` string. Default `"10%"`.
 * @prop {number}        gutterSize - Gutter thickness in px. Default `6`.
 * @prop {Object}        labels     - Override UI strings. Keys: `resize`. Unset keys keep the English default.
 * @prop {number[]}      sizes      - Read-only getter: current panel sizes as percentages summing to ~100.
 * @attr {boolean}       vertical   - Declarative form of `vertical`.
 * @attr {string}        min-size   - Declarative form of `minSize`.
 * @attr {number}        gutter-size - Declarative form of `gutterSize`.
 * @attr {number}        data-size  - Per-PANEL (on each child): initial size weight; panels without it share the remainder equally.
 *
 * @fires resize - `CustomEvent` (bubbles) on every size change (drag or keyboard). `detail = { sizes: number[] }` (percentages).
 *
 * @cssprop [--pd-splitter-gutter] - Gutter thickness (defaults to the `gutterSize` property / `6px`).
 *
 * @example
 * // <puredashboard-splitter style="height:240px">
 * //   <div data-size="60">left</div>
 * //   <div>right</div>
 * // </puredashboard-splitter>
 * const sp = document.querySelector("puredashboard-splitter");
 * sp.addEventListener("resize", (e) => console.log(e.detail.sizes)); // [60, 40]
 */
class PuredashboardSplitter extends HTMLElement {
  static get observedAttributes() { return ["vertical", "min-size", "gutter-size"]; }

  constructor() {
    super();
    this._inited = false;
    this._panels = [];
    this._gutters = [];
    this._sizes = [];
    this._drag = null;
    this._minSize = "10%";
    this._gutterSize = 6;
    // A template engine may set properties before upgrade, leaving plain
    // own-properties that shadow the accessors; reconcile them (input-family parity).
    for (const p of ["vertical", "minSize", "gutterSize", "labels"]) this._upgrade(p);
  }

  _upgrade(p) {
    if (Object.prototype.hasOwnProperty.call(this, p)) { const v = this[p]; delete this[p]; this[p] = v; }
  }

  // ---- configurable properties (mirrored to attributes where declarative) ----
  get vertical() { return this.hasAttribute("vertical"); }
  set vertical(v) {
    if (v) this.setAttribute("vertical", ""); else this.removeAttribute("vertical");
    if (this._inited) this._applyOrientation();
  }

  get minSize() { return this._minSize; }
  set minSize(v) { this._minSize = v == null ? "10%" : v; if (this._inited) this._refreshAria(); }

  get gutterSize() { return this._gutterSize; }
  set gutterSize(v) { const n = Number(v); this._gutterSize = Number.isFinite(n) && n >= 0 ? n : 6; if (this._inited) this._applyGutterSize(); }

  get sizes() { return this._sizes.slice(); }

  attributeChangedCallback(name, _old, val) {
    if (name === "vertical") { if (this._inited) this._applyOrientation(); }
    else if (name === "min-size") { this.minSize = val == null ? "10%" : val; }
    else if (name === "gutter-size") { this.gutterSize = val == null ? 6 : val; }
  }

  // _label(key, …args) → localised string: this.labels override, else the default.
  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  connectedCallback() { this._init(); }

  // Adopt the author's direct element children as panels and weave in gutters.
  // Guarded so it runs exactly once, even across disconnect/reconnect —
  // re-adopting would double-insert gutters.
  _init() {
    if (this._inited) return;
    const panels = Array.from(this.children).filter(
      (c) => c.nodeType === 1 && !c.classList.contains("puredashboard-splitter__gutter"),
    );
    if (panels.length === 0) return; // nothing to split yet; try again on a later connect
    this._inited = true;
    this._panels = panels;

    // Initial sizes: honour a per-panel data-size weight where present; panels
    // without one share the remaining weight equally. Normalise to percentages.
    const n = panels.length;
    let raw = panels.map((p) => { const v = parseFloat(p.getAttribute("data-size")); return Number.isFinite(v) && v > 0 ? v : null; });
    const known = raw.reduce((a, v) => a + (v || 0), 0);
    const unknown = raw.filter((v) => v == null).length;
    const fill = unknown > 0 ? Math.max(0, 100 - known) / unknown : 0;
    raw = raw.map((v) => (v == null ? (fill > 0 ? fill : 100 / n) : v));
    const sum = raw.reduce((a, b) => a + b, 0) || 1;
    this._sizes = raw.map((v) => (v / sum) * 100);

    // Panels: a BEM class carries the layout resets (min-size:0 + overflow) so
    // author content can shrink; the size itself is a DYNAMIC inline flex-grow.
    for (const p of panels) p.classList.add("puredashboard-splitter__panel");
    this._applySizes();

    // Gutters between each adjacent pair (n panels → n-1 gutters).
    this._gutters = [];
    for (let i = 0; i < n - 1; i++) {
      const g = this._buildGutter(i);
      panels[i].after(g);
      this._gutters.push(g);
    }
    this._refreshAria();
  }

  disconnectedCallback() {
    for (const g of this._gutters) {
      g.removeEventListener("pointerdown", this._onPointerDown);
      g.removeEventListener("keydown", this._onKeyDown);
    }
  }

  _buildGutter(i) {
    const g = document.createElement("div");
    g.className = "puredashboard-splitter__gutter js-puredashboard-splitter__gutter";
    g.dataset.gutter = String(i);
    g.setAttribute("role", "separator");
    g.setAttribute("tabindex", "0");
    g.setAttribute("aria-orientation", this.vertical ? "horizontal" : "vertical");
    g.setAttribute("aria-label", this._label("resize"));
    g.style.flex = `0 0 ${this._gutterSize}px`;
    const grip = document.createElement("span");
    grip.className = "puredashboard-splitter__grip";
    grip.setAttribute("aria-hidden", "true");
    g.appendChild(grip);
    g.addEventListener("pointerdown", this._onPointerDown);
    g.addEventListener("keydown", this._onKeyDown);
    return g;
  }

  // Write the current percentages onto the panels as proportional flex-grow.
  // flex-basis:0 makes the grow ratio govern the whole layout, so fixed-size
  // gutters are subtracted automatically and the panels stay responsive.
  _applySizes() {
    this._panels.forEach((p, i) => { p.style.flexGrow = String(this._sizes[i]); });
  }

  _applyGutterSize() { for (const g of this._gutters) g.style.flex = `0 0 ${this._gutterSize}px`; }
  _applyOrientation() { for (const g of this._gutters) g.setAttribute("aria-orientation", this.vertical ? "horizontal" : "vertical"); }
  _refreshAria() { this._gutters.forEach((_g, i) => this._updateGutter(i)); }

  // Length of the container along the split axis, in px. Guarded for jsdom /
  // detached nodes (no layout) so the pointer math degrades to a no-op there.
  _containerLen() {
    if (typeof this.getBoundingClientRect !== "function") return 0;
    const r = this.getBoundingClientRect();
    const len = this.vertical ? r.height : r.width;
    return Number.isFinite(len) ? len : 0;
  }

  // The minimum panel size expressed as a percentage. A "%" value is used as-is;
  // a px value needs the live container length (0 when there's no layout).
  _minPct() {
    const ms = String(this.minSize ?? "").trim();
    if (ms.endsWith("%")) return clamp(parseFloat(ms) || 0, 0, 100);
    const px = parseFloat(ms);
    if (!Number.isFinite(px)) return 0;
    const len = this._containerLen();
    return len > 0 ? clamp((px / len) * 100, 0, 100) : 0;
  }

  // Resize the pair around gutter `gi` so the LEFT/TOP panel takes `leftPct`
  // (clamped to the min on both sides); the pair's combined size is conserved.
  _setPair(gi, leftPct) {
    const a = gi, b = gi + 1;
    if (b >= this._sizes.length) return;
    const combined = this._sizes[a] + this._sizes[b];
    const lo = Math.min(this._minPct(), combined / 2);
    const hi = combined - lo;
    const left = clamp(leftPct, lo, hi);
    this._sizes[a] = left;
    this._sizes[b] = combined - left;
    this._applySizes();
    this._updateGutter(gi);
    this._emit();
  }

  _updateGutter(gi) {
    const g = this._gutters[gi];
    if (!g) return;
    const combined = this._sizes[gi] + this._sizes[gi + 1];
    const lo = Math.min(this._minPct(), combined / 2);
    g.setAttribute("aria-valuemin", String(Math.round(lo)));
    g.setAttribute("aria-valuemax", String(Math.round(combined - lo)));
    g.setAttribute("aria-valuenow", String(Math.round(this._sizes[gi])));
  }

  _emit() { this.dispatchEvent(new CustomEvent("resize", { bubbles: true, detail: { sizes: this._sizes.slice() } })); }

  // ---- drag (pointer events + pointer capture) -----------------------------
  _onPointerDown = (e) => {
    const gi = Number(e.currentTarget.dataset.gutter);
    if (Number.isNaN(gi)) return;
    e.preventDefault();
    const g = e.currentTarget;
    try { g.setPointerCapture(e.pointerId); } catch { /* jsdom / unsupported */ }
    this._drag = { gi, start: this.vertical ? e.clientY : e.clientX, startLeft: this._sizes[gi], len: this._containerLen() };
    g.classList.add("puredashboard-splitter__gutter--active");
    g.addEventListener("pointermove", this._onPointerMove);
    g.addEventListener("pointerup", this._onPointerUp);
    g.addEventListener("pointercancel", this._onPointerUp);
  };

  _onPointerMove = (e) => {
    const d = this._drag;
    if (!d || !(d.len > 0)) return; // no layout → nothing meaningful to compute
    const pos = this.vertical ? e.clientY : e.clientX;
    const deltaPct = ((pos - d.start) / d.len) * 100;
    this._setPair(d.gi, d.startLeft + deltaPct);
  };

  _onPointerUp = (e) => {
    if (!this._drag) return;
    const g = e.currentTarget;
    try { g.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    g.classList.remove("puredashboard-splitter__gutter--active");
    g.removeEventListener("pointermove", this._onPointerMove);
    g.removeEventListener("pointerup", this._onPointerUp);
    g.removeEventListener("pointercancel", this._onPointerUp);
    this._drag = null;
  };

  // ---- keyboard (WAI-ARIA separator pattern) --------------------------------
  _onKeyDown = (e) => {
    const gi = Number(e.currentTarget.dataset.gutter);
    if (Number.isNaN(gi)) return;
    const incKey = this.vertical ? "ArrowDown" : "ArrowRight"; // grow the left/top panel
    const decKey = this.vertical ? "ArrowUp" : "ArrowLeft";
    let handled = true;
    if (e.key === incKey) this._setPair(gi, this._sizes[gi] + STEP);
    else if (e.key === decKey) this._setPair(gi, this._sizes[gi] - STEP);
    else if (e.key === "Home") this._setPair(gi, -Infinity); // clamps to min
    else if (e.key === "End") this._setPair(gi, Infinity);   // clamps to max
    else handled = false;
    if (handled) e.preventDefault();
  };
}

customElements.define("puredashboard-splitter", PuredashboardSplitter);

export { PuredashboardSplitter };
