// <puredashboard-row> + <puredashboard-col> — a 24-column responsive grid.
// Zero-dep, no build, CSP-safe. Both extend plain HTMLElement (NOT Reactive) —
// they are purely presentational LAYOUT containers whose whole job is to hold
// and lay out the author's light-DOM children (a row's children are its cols; a
// col's children are arbitrary content). A Reactive render() would blow those
// authored children away, so these stay pure DOM: they only set a handful of
// inline CSS custom properties (--pd-row-gutter, --pd-col-span, --pd-col-md, …)
// that the co-located grid.css consumes — never touching innerHTML.
//
// Layout math (24-column, mobile-first):
//   • A row is `display:flex; flex-wrap:wrap`. Its `gutter` becomes the flex
//     `gap` via an inline `--pd-row-gutter` custom property.
//   • A col is a flex child whose width is `span/24` of the row, expressed as a
//     percentage minus its share of the gutter. The base span is written to
//     `--pd-col-span` and the width computed with `calc()` in grid.css.
//   • Responsive spans (xs/sm/md/lg/xl) are written to per-breakpoint custom
//     properties (--pd-col-xs … --pd-col-xl); standard `@media` blocks in
//     grid.css read them. Because each breakpoint only overrides when its own
//     property is set, an unset breakpoint inherits the next-smaller one —
//     mobile-first cascading for free.
//
// Follows the library conventions: BEM classes namespaced by the tag, theming
// through the shared spacing tokens (--sp-*) with a --pd-* fallback chain so it
// works with NO theme linked, and attribute changes reflected into the element.

// All FIXED user-facing strings live here (English defaults). Override any
// subset via the `labels` property. The grid is purely presentational, so this
// only carries an a11y fallback; function-valued keys interpolate.
const LABELS = {
  row: "Row",
};

// Named gutter presets → the shared spacing tokens. Anything not in this map is
// treated as a raw pixel number (see _gutterValue).
const GUTTER_PRESETS = {
  sm: "var(--sp-2, 8px)",
  md: "var(--sp-4, 16px)",
  lg: "var(--sp-6, 24px)",
};

// The responsive breakpoint attribute names, smallest → largest. Kept in one
// place so the element and grid.css stay in agreement.
const BREAKPOINTS = ["xs", "sm", "md", "lg", "xl"];

// Clamp a parsed span into the valid `min`..24 range (min is 1 for spans, 0 for
// offsets). An absent (null) or blank attribute yields null so callers can clear
// the corresponding custom property rather than defaulting it to a value.
const clampSpan = (raw, min) => {
  if (raw == null || raw === "") return null;
  const v = Math.round(Number(raw));
  if (!Number.isFinite(v)) return null;
  return Math.max(min, Math.min(24, v));
};

/**
 * A horizontal flex container for the 24-column grid. Lays its
 * `<puredashboard-col>` children out in a wrapping flex row and applies the
 * horizontal gutter as the flex `gap`. Purely presentational — no events, no
 * shadow DOM; the author's children (the columns) are preserved untouched.
 *
 * Configure via JS properties or declarative attributes; attribute changes are
 * reflected live.
 *
 * @element puredashboard-row
 *
 * @attr {string} gutter  - Gap between columns: a raw pixel number (e.g. `"16"`) OR a preset `"sm"`|`"md"`|`"lg"` → the shared `--sp-*` tokens. Default none (`0`).
 * @attr {string} align   - Cross-axis (vertical) alignment: `"top"` | `"middle"` | `"bottom"`. Default `"top"`.
 * @attr {string} justify - Main-axis (horizontal) distribution: `"start"` | `"center"` | `"end"` | `"between"` | `"around"`. Default `"start"`.
 *
 * @prop {string} gutter  - Reflects the `gutter` attribute.
 * @prop {string} align   - Reflects the `align` attribute.
 * @prop {string} justify - Reflects the `justify` attribute.
 * @prop {Object} labels  - Override UI strings. Keys: `row`. Unset keys keep the English default.
 *
 * @cssprop [--pd-row-gutter] - The resolved gutter, applied as the flex `gap` (set inline from the `gutter` attribute).
 *
 * @example
 * // <puredashboard-row gutter="md" align="middle" justify="between">
 * //   <puredashboard-col span="12">left</puredashboard-col>
 * //   <puredashboard-col span="12">right</puredashboard-col>
 * // </puredashboard-row>
 */
class PuredashboardRow extends HTMLElement {
  static get observedAttributes() { return ["gutter", "align", "justify"]; }

  constructor() {
    super();
    // A template engine may set a property before upgrade, leaving a plain
    // own-property that shadows the accessor — reconcile for parity with the
    // rest of the library.
    for (const p of ["gutter", "align", "justify", "labels"]) this._upgrade(p);
  }

  _upgrade(p) {
    if (Object.prototype.hasOwnProperty.call(this, p)) { const v = this[p]; delete this[p]; this[p] = v; }
  }

  // Property ⇆ attribute reflection so the row can be configured either way.
  get gutter() { return this.getAttribute("gutter"); }
  set gutter(v) { v == null ? this.removeAttribute("gutter") : this.setAttribute("gutter", v); }
  get align() { return this.getAttribute("align"); }
  set align(v) { v == null ? this.removeAttribute("align") : this.setAttribute("align", v); }
  get justify() { return this.getAttribute("justify"); }
  set justify(v) { v == null ? this.removeAttribute("justify") : this.setAttribute("justify", v); }

  // _label(key, …args) → localised string: this.labels override, else the default.
  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  connectedCallback() {
    this.classList.add("puredashboard-row");
    if (!this.hasAttribute("role")) this.setAttribute("role", "group");
    if (!this.hasAttribute("aria-label")) this.setAttribute("aria-label", this._label("row"));
    this._apply();
  }

  attributeChangedCallback() { this._apply(); }

  // Resolve `gutter` to a CSS length: a named preset → its --sp-* token, else a
  // raw pixel number. Empty/unset → 0.
  _gutterValue() {
    const g = this.getAttribute("gutter");
    if (g == null || g === "") return "0px";
    if (GUTTER_PRESETS[g]) return GUTTER_PRESETS[g];
    const n = Number(g);
    return Number.isFinite(n) ? `${n}px` : "0px";
  }

  // Reflect the current attributes into presentational state: the gutter as an
  // inline custom property (consumed as the flex `gap` in grid.css) and the
  // align/justify choices as BEM modifier classes.
  _apply() {
    this.style.setProperty("--pd-row-gutter", this._gutterValue());

    const align = this.getAttribute("align") || "top";
    for (const a of ["top", "middle", "bottom"])
      this.classList.toggle(`puredashboard-row--align-${a}`, a === align);

    const justify = this.getAttribute("justify") || "start";
    for (const j of ["start", "center", "end", "between", "around"])
      this.classList.toggle(`puredashboard-row--justify-${j}`, j === justify);
  }
}

/**
 * A flex child sized by a 24-based `span`, for use inside `<puredashboard-row>`.
 * Its width is `span / 24` of the row; `offset` pushes it right by `offset / 24`
 * via a left margin. Responsive attributes (`xs`/`sm`/`md`/`lg`/`xl`) each set a
 * span that applies from that breakpoint up — mobile-first: an unset breakpoint
 * inherits the next-smaller defined span. Purely presentational; the author's
 * children (the column's content) are preserved untouched.
 *
 * Widths are emitted as inline CSS custom properties (`--pd-col-span`,
 * `--pd-col-xs` … `--pd-col-xl`) that predefined `@media` breakpoints in
 * grid.css turn into `calc()` widths — the standard breakpoints are sm 576px,
 * md 768px, lg 992px, xl 1200px.
 *
 * @element puredashboard-col
 *
 * @attr {number} span   - Base column span, `1`..`24` (width = `span/24`). Unset → full width.
 * @attr {number} offset - Left offset, `0`..`24` (margin-left = `offset/24`). Default `0`.
 * @attr {number} xs     - Span applied at the extra-small breakpoint and up.
 * @attr {number} sm     - Span applied from `min-width: 576px`.
 * @attr {number} md     - Span applied from `min-width: 768px`.
 * @attr {number} lg     - Span applied from `min-width: 992px`.
 * @attr {number} xl     - Span applied from `min-width: 1200px`.
 *
 * @prop {number|string} span   - Reflects the `span` attribute.
 * @prop {number|string} offset - Reflects the `offset` attribute.
 * @prop {Object}        labels  - Reserved for parity; the col carries no UI strings by default.
 *
 * @cssprop [--pd-col-span] - The base span (1..24), consumed by a `width: calc(...)` in grid.css.
 * @cssprop [--pd-col-xs]   - Span at the xs breakpoint (set inline when the `xs` attribute is present).
 * @cssprop [--pd-col-sm]   - Span from 576px (set inline when the `sm` attribute is present).
 * @cssprop [--pd-col-md]   - Span from 768px (set inline when the `md` attribute is present).
 * @cssprop [--pd-col-lg]   - Span from 992px (set inline when the `lg` attribute is present).
 * @cssprop [--pd-col-xl]   - Span from 1200px (set inline when the `xl` attribute is present).
 *
 * @example
 * // Full width on mobile, half from md up, one-third from lg up:
 * // <puredashboard-col span="24" md="12" lg="8">…</puredashboard-col>
 */
class PuredashboardCol extends HTMLElement {
  static get observedAttributes() { return ["span", "offset", ...BREAKPOINTS]; }

  constructor() {
    super();
    for (const p of ["span", "offset", "labels"]) this._upgrade(p);
  }

  _upgrade(p) {
    if (Object.prototype.hasOwnProperty.call(this, p)) { const v = this[p]; delete this[p]; this[p] = v; }
  }

  get span() { return this.getAttribute("span"); }
  set span(v) { v == null ? this.removeAttribute("span") : this.setAttribute("span", v); }
  get offset() { return this.getAttribute("offset"); }
  set offset(v) { v == null ? this.removeAttribute("offset") : this.setAttribute("offset", v); }

  connectedCallback() {
    this.classList.add("puredashboard-col");
    this._apply();
  }

  attributeChangedCallback() { this._apply(); }

  // Reflect span/offset/responsive attributes into inline custom properties.
  // grid.css turns --pd-col-span into `width: calc(...)`; each --pd-col-<bp> is
  // read by that breakpoint's @media block. Unset breakpoints leave their
  // property untouched, so the width cascades from the next-smaller one.
  _apply() {
    const span = clampSpan(this.getAttribute("span"), 1);
    if (span != null) this.style.setProperty("--pd-col-span", String(span));
    else this.style.removeProperty("--pd-col-span");

    const offset = clampSpan(this.getAttribute("offset"), 0);
    if (offset != null && offset > 0) this.style.setProperty("--pd-col-offset", String(offset));
    else this.style.removeProperty("--pd-col-offset");

    for (const bp of BREAKPOINTS) {
      const v = clampSpan(this.getAttribute(bp), 1);
      const prop = `--pd-col-${bp}`;
      if (v != null) this.style.setProperty(prop, String(v));
      else this.style.removeProperty(prop);
    }
  }
}

customElements.define("puredashboard-row", PuredashboardRow);
customElements.define("puredashboard-col", PuredashboardCol);

export { PuredashboardRow, PuredashboardCol };
