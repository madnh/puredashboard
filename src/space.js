// <puredashboard-space> — a spacing container that lays out its children in a row
// or column with a consistent gap. Zero-dep, no build, CSP-safe. Extends plain
// HTMLElement (NOT Reactive) — a Reactive render() would blow away the author's
// light-DOM children, and this component's whole job is to PRESERVE them and lay
// them out directly. The host itself becomes the flex container; the author's
// children are the flex items, untouched and unwrapped.
//
// Purely presentational: it sets display:flex on the host and drives
// direction/gap/align/justify/wrap from properties+attributes via BEM modifier
// classes plus a dynamic `--pd-space-gap` custom property (the only inline-ish
// dynamic value, which is CSP-allowed for styles). No events, no wrapping nodes.
// Follows the library conventions: fixed strings in a LABELS map + a `labels`
// override, BEM classes namespaced by the tag, and theming through the shared
// spacing tokens (--sp-*) with a --pd-* fallback chain so it works with no theme.

// All FIXED user-facing strings live here (English defaults). Override any subset
// via the `labels` property. This component is purely presentational and renders
// no text of its own, so the map is intentionally minimal — kept for parity with
// the rest of the library and so future strings have a home.
const LABELS = {};

// Named sizes map to shared spacing tokens. A numeric value (number or a numeric
// string) is treated as a raw pixel gap instead.
const SIZE_TOKENS = {
  sm: "var(--sp-2, 8px)",
  md: "var(--sp-3, 12px)",
  lg: "var(--sp-4, 16px)",
};

/**
 * A spacing container. Makes its host a flex container and lays out the author's
 * light-DOM children — which stay the DIRECT flex items, unmoved and unwrapped —
 * in a row (default) or column with a consistent gap. Purely presentational: no
 * events, no shadow DOM, no wrapper nodes. Configure via JS properties or
 * declarative attributes; attribute changes are reflected live.
 *
 * @element puredashboard-space
 *
 * @prop {string}  direction - `"horizontal"` (default) | `"vertical"` — the flex main axis.
 * @prop {string}  size      - `"sm"` | `"md"` (default) | `"lg"` mapping to `--sp-2/3/4`, OR a number / numeric string → a raw pixel gap.
 * @prop {string}  align     - Cross-axis alignment: `"start"` | `"center"` | `"end"` | `"baseline"`. Default unset (browser `normal`/stretch).
 * @prop {string}  justify   - Main-axis distribution: `"start"` | `"center"` | `"end"` | `"between"` | `"around"`. Default unset (`flex-start`).
 * @prop {boolean} wrap      - Allow items to wrap onto multiple lines. Defaults to `true` for horizontal, `false` for vertical.
 * @prop {Object}  labels    - Override UI strings. This component renders no text, so usually unused; unset keys keep the English default.
 * @attr {string}  direction - Declarative form of `direction`.
 * @attr {string}  size      - Declarative form of `size`.
 * @attr {string}  align     - Declarative form of `align`.
 * @attr {string}  justify   - Declarative form of `justify`.
 * @attr {boolean} wrap      - Declarative form of `wrap` (presence = wrap; use `wrap="false"` / omit to disable).
 *
 * @cssprop [--pd-space-gap] - The computed gap between items; set inline from `size`.
 *
 * @example
 * // <puredashboard-space direction="horizontal" size="lg" align="center" justify="between">
 * //   <button>One</button>
 * //   <button>Two</button>
 * // </puredashboard-space>
 * const sp = document.createElement("puredashboard-space");
 * sp.direction = "vertical"; sp.size = 24; // 24px gap
 * sp.append(a, b, c); // a, b, c become the direct flex items
 */
class PuredashboardSpace extends HTMLElement {
  static get observedAttributes() { return ["direction", "size", "align", "justify", "wrap"]; }

  constructor() {
    super();
    this._direction = "horizontal";
    this._size = "md";
    this._align = "";
    this._justify = "";
    this._wrap = null; // null = "auto" (defaults per direction)
    // A template engine may set these properties before upgrade, leaving plain
    // own-properties that shadow the accessors. Reconcile them for parity with
    // the rest of the library.
    for (const p of ["direction", "size", "align", "justify", "wrap", "labels"]) this._upgrade(p);
  }

  _upgrade(p) {
    if (Object.prototype.hasOwnProperty.call(this, p)) { const v = this[p]; delete this[p]; this[p] = v; }
  }

  // _label(key, …args) → localised string: this.labels override, else the default.
  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  connectedCallback() { this._apply(); }

  // Reflect declarative HTML attributes into properties. `wrap` is boolean-ish:
  // absent → auto; present with any value other than "false" → wrap on.
  attributeChangedCallback(name, _old, val) {
    if (name === "wrap") { this._wrap = val === null ? null : val !== "false"; this._apply(); return; }
    this["_" + name] = val ?? "";
    this._apply();
  }

  // ---- properties -----------------------------------------------------------
  get direction() { return this._direction || "horizontal"; }
  set direction(v) { this._direction = v || "horizontal"; this._apply(); }

  get size() { return this._size; }
  set size(v) { this._size = v; this._apply(); }

  get align() { return this._align || ""; }
  set align(v) { this._align = v || ""; this._apply(); }

  get justify() { return this._justify || ""; }
  set justify(v) { this._justify = v || ""; this._apply(); }

  // wrap: true/false explicitly, or the direction-based default when unset.
  get wrap() { return this._wrap == null ? this.direction !== "vertical" : !!this._wrap; }
  set wrap(v) { this._wrap = v == null ? null : !!v; this._apply(); }

  // Resolve `size` to a CSS gap value: a named token, else a raw pixel length for
  // numbers / numeric strings, else fall back to the medium token.
  _gap() {
    const s = this._size;
    if (s == null || s === "") return SIZE_TOKENS.md;
    if (Object.prototype.hasOwnProperty.call(SIZE_TOKENS, s)) return SIZE_TOKENS[s];
    const n = typeof s === "number" ? s : (String(s).trim() !== "" && !isNaN(Number(s)) ? Number(s) : NaN);
    if (!isNaN(n)) return `${n}px`;
    return SIZE_TOKENS.md;
  }

  // The single place that writes the DOM: set BEM modifier classes on the host and
  // the dynamic gap custom property. Never touches or wraps the author's children —
  // they remain the direct flex items of the (now flex) host.
  _apply() {
    const vertical = this.direction === "vertical";

    // Base block class (idempotent) — the CSS turns the host into a flex container.
    this.classList.add("puredashboard-space");

    // Direction modifiers.
    this.classList.toggle("puredashboard-space--vertical", vertical);
    this.classList.toggle("puredashboard-space--horizontal", !vertical);

    // Wrap modifier.
    this.classList.toggle("puredashboard-space--wrap", this.wrap);
    this.classList.toggle("puredashboard-space--nowrap", !this.wrap);

    // Align (cross axis) — one modifier at a time.
    for (const a of ["start", "center", "end", "baseline"]) {
      this.classList.toggle(`puredashboard-space--align-${a}`, this._align === a);
    }

    // Justify (main axis) — one modifier at a time.
    for (const j of ["start", "center", "end", "between", "around"]) {
      this.classList.toggle(`puredashboard-space--justify-${j}`, this._justify === j);
    }

    // Dynamic gap value (CSP-allowed inline style for a *dynamic* value).
    this.style.setProperty("--pd-space-gap", this._gap());
  }
}

customElements.define("puredashboard-space", PuredashboardSpace);

export { PuredashboardSpace };
