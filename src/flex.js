// <puredashboard-flex> — a flexbox LAYOUT wrapper (sibling of <puredashboard-space>,
// but matching Antd's <Flex>). Zero-dep, no build, CSP-safe. Extends plain
// HTMLElement (NOT Reactive) — a Reactive render() would blow away the author's
// light-DOM children, and this component's whole job is to PRESERVE them and lay
// them out directly. The host itself becomes the flex container; the author's
// children are the flex items, untouched and unwrapped.
//
// Where <space> is a compact "put a gap between a few controls" helper, <flex>
// exposes the full flexbox knob set (direction, justify, align, wrap, gap) as a
// thin, declarative wrapper. Purely presentational: it sets display:flex on the
// host and drives the axes from properties+attributes via BEM modifier classes
// plus a dynamic `--pd-flex-gap` custom property (the only inline-ish dynamic
// value, which is CSP-allowed for styles). No events, no wrapping nodes.
// Follows the library conventions: fixed strings in a LABELS map + a `labels`
// override, BEM classes namespaced by the tag, and theming through the shared
// spacing tokens (--sp-*) with a --pd-* fallback chain so it works with no theme.

// All FIXED user-facing strings live here (English defaults). Override any subset
// via the `labels` property. This component is purely presentational and renders
// no text of its own, so the map is intentionally minimal — kept for parity with
// the rest of the library and so future strings have a home.
const LABELS = {};

// Named gap sizes map to shared spacing tokens. A raw CSS length (e.g. "12px",
// "1rem") is used verbatim instead.
const GAP_TOKENS = {
  sm: "var(--sp-2, 8px)",
  md: "var(--sp-3, 12px)",
  lg: "var(--sp-4, 16px)",
};

// Allowed keyword sets — an unknown value clears the modifier (no styling).
const JUSTIFY = ["start", "center", "end", "between", "around", "evenly"];
const ALIGN = ["start", "center", "end", "stretch", "baseline"];

/**
 * A flexbox layout wrapper. Makes its host a flex container and lays out the
 * author's light-DOM children — which stay the DIRECT flex items, unmoved and
 * unwrapped — along a row (default) or column, with full control over
 * distribution, alignment, wrapping and gap. Mirrors Antd's `<Flex>`. Purely
 * presentational: no events, no shadow DOM, no wrapper nodes. Configure via JS
 * properties or declarative attributes; attribute changes are reflected live.
 *
 * @element puredashboard-flex
 *
 * @prop {boolean} vertical - Stack children in a column (`flex-direction: column`) instead of a row. Default `false`.
 * @prop {string}  justify  - Main-axis distribution: `"start"` | `"center"` | `"end"` | `"between"` | `"around"` | `"evenly"`. Default unset (`flex-start`).
 * @prop {string}  align    - Cross-axis alignment: `"start"` | `"center"` | `"end"` | `"stretch"` | `"baseline"`. Default unset (browser `normal`/stretch).
 * @prop {boolean|string} wrap - Allow items to wrap: `true`/`"wrap"`, `false`/`"nowrap"` (default), or `"reverse"` (`wrap-reverse`).
 * @prop {string}  gap      - `"sm"` | `"md"` | `"lg"` mapping to `--sp-2/3/4`, OR a raw CSS length (`"12px"`, `"1rem"`) used as-is. Default none.
 * @prop {Object}  labels   - Override UI strings. This component renders no text, so usually unused; unset keys keep the English default.
 *
 * @attr {boolean} vertical - Declarative form of `vertical` (presence = on).
 * @attr {string}  justify  - Declarative form of `justify`.
 * @attr {string}  align    - Declarative form of `align`.
 * @attr {string}  wrap     - Declarative form of `wrap` (`""`/`"wrap"` = on, `"reverse"`, `"nowrap"`/absent = off).
 * @attr {string}  gap      - Declarative form of `gap`.
 *
 * @cssprop [--pd-flex-gap] - The computed gap between items; set inline from `gap`.
 *
 * @example
 * // <puredashboard-flex justify="between" align="center" gap="md">
 * //   <button>One</button>
 * //   <button>Two</button>
 * // </puredashboard-flex>
 * const f = document.createElement("puredashboard-flex");
 * f.vertical = true; f.gap = "16px"; // 16px gap, column layout
 * f.append(a, b, c); // a, b, c become the direct flex items
 */
class PuredashboardFlex extends HTMLElement {
  static get observedAttributes() { return ["vertical", "justify", "align", "wrap", "gap"]; }

  constructor() {
    super();
    this._vertical = false;
    this._justify = "";
    this._align = "";
    this._wrap = false; // false = nowrap, true = wrap, "reverse" = wrap-reverse
    this._gap = "";
    // A template engine may set these properties before upgrade, leaving plain
    // own-properties that shadow the accessors. Reconcile them for parity with
    // the rest of the library.
    for (const p of ["vertical", "justify", "align", "wrap", "gap", "labels"]) this._upgrade(p);
  }

  _upgrade(p) {
    if (Object.prototype.hasOwnProperty.call(this, p)) { const v = this[p]; delete this[p]; this[p] = v; }
  }

  // _label(key, …args) → localised string: this.labels override, else the default.
  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  connectedCallback() { this._apply(); }

  // Reflect declarative HTML attributes into properties. `vertical` is a boolean
  // attribute (presence = on). `wrap` is tri-state: absent/"nowrap"/"false" → off,
  // "reverse" → wrap-reverse, anything else (incl. "" / "wrap") → wrap on.
  attributeChangedCallback(name, _old, val) {
    if (name === "vertical") { this._vertical = val !== null && val !== "false"; }
    else if (name === "wrap") { this._wrap = this._parseWrap(val); }
    else { this["_" + name] = val ?? ""; }
    this._apply();
  }

  // Normalise a wrap value (attr string or JS value) to false | true | "reverse".
  _parseWrap(v) {
    if (v === "reverse" || v === "wrap-reverse") return "reverse";
    if (v == null || v === false || v === "false" || v === "nowrap") return false;
    return true; // true, "", "wrap", or any truthy value
  }

  // ---- properties -----------------------------------------------------------
  get vertical() { return this._vertical; }
  set vertical(v) { this._vertical = !!v; this._apply(); }

  get justify() { return this._justify || ""; }
  set justify(v) { this._justify = v || ""; this._apply(); }

  get align() { return this._align || ""; }
  set align(v) { this._align = v || ""; this._apply(); }

  get wrap() { return this._wrap; }
  set wrap(v) { this._wrap = this._parseWrap(v); this._apply(); }

  get gap() { return this._gap; }
  set gap(v) { this._gap = v == null ? "" : v; this._apply(); }

  // Resolve `gap` to a CSS gap value: a named token, else the raw length as-is,
  // else empty (no gap) — the CSS default of 0 then applies.
  _gapValue() {
    const g = this._gap;
    if (g == null || g === "") return "";
    if (Object.prototype.hasOwnProperty.call(GAP_TOKENS, g)) return GAP_TOKENS[g];
    return String(g); // raw CSS length used verbatim
  }

  // The single place that writes the DOM: set BEM modifier classes on the host and
  // the dynamic gap custom property. Never touches or wraps the author's children —
  // they remain the direct flex items of the (now flex) host.
  _apply() {
    // Base block class (idempotent) — the CSS turns the host into a flex container.
    this.classList.add("puredashboard-flex");

    // Direction modifier (row is the default, expressed only as the absence of
    // --vertical so the base rule handles it).
    this.classList.toggle("puredashboard-flex--vertical", this._vertical);

    // Wrap modifiers — at most one of wrap / wrap-reverse.
    this.classList.toggle("puredashboard-flex--wrap", this._wrap === true);
    this.classList.toggle("puredashboard-flex--wrap-reverse", this._wrap === "reverse");

    // Justify (main axis) — one modifier at a time.
    for (const j of JUSTIFY) {
      this.classList.toggle(`puredashboard-flex--justify-${j}`, this._justify === j);
    }

    // Align (cross axis) — one modifier at a time.
    for (const a of ALIGN) {
      this.classList.toggle(`puredashboard-flex--align-${a}`, this._align === a);
    }

    // Dynamic gap value (CSP-allowed inline style for a *dynamic* value).
    const gap = this._gapValue();
    if (gap) this.style.setProperty("--pd-flex-gap", gap);
    else this.style.removeProperty("--pd-flex-gap");
  }
}

customElements.define("puredashboard-flex", PuredashboardFlex);

export { PuredashboardFlex };
