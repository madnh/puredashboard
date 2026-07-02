// <puredashboard-progress> — a progress indicator (linear bar or circular ring).
// Zero-dep, no build, CSP-safe. Built on the Reactive base.
//
// A DISPLAY-only control (not a form input), so it is NOT form-associated — it just
// paints the current fraction of a task. Two shapes share one component:
//   • "line"   — a rounded track + a fill whose WIDTH is driven by a DYNAMIC inline
//                custom property (--pd-progress-pct), exactly like slider.js paints
//                its filled track (allowed by the CSP style policy — a computed value).
//   • "circle" — an inline self-contained SVG ring: a background circle plus a
//                foreground stroke whose stroke-dasharray = circumference and
//                stroke-dashoffset = circumference * (1 - fraction), so the visible
//                arc is exactly the percent (computed from the radius).
// When `indeterminate`, there is no known value: the bar/ring animate a sweep via CSS
// keyframes, aria-valuenow is omitted, and a --indeterminate modifier is added. The
// animation honours prefers-reduced-motion (the CSS collapses it).
//
// Class naming (BEM, block = the component tag): every style class is namespaced
// `puredashboard-progress__<element>[--<modifier>]`; there are no script hooks (nothing
// is interactive). Themed through the shared design tokens (--accent, --green, --red,
// --panel-3, --radius-full, --text/--muted, --duration-*, --font-size-sm) via a --pd-*
// fallback chain so it looks right with NO theme linked. All user-facing strings live in
// a LABELS map. See docs/DEVELOPMENT.md → "Definition of Done".
import { Reactive, html } from "./reactive.js";
import { raw } from "./html.js";

// Inline, self-contained status glyphs (no shared icon module). Sized in em so they
// scale with the surrounding text.
const svg = (b) => raw(`<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-.14em;overflow:visible;flex:none" aria-hidden="true">${b}</svg>`);
const checkGlyph = svg('<path d="M20 6 9 17l-5-5"/>');
const crossGlyph = svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>');

// All user-facing strings live here (English defaults). Override any subset via the
// `labels` property to localise — e.g. pr.labels = { label: (p) => `Đã xong ${p}%` }.
// Function-valued keys interpolate.
const LABELS = {
  // Accessible label (and, when showInfo, the visible read-out); the rounded percent
  // is passed in. When indeterminate the percent is null.
  label: (pct) => (pct == null ? "Loading" : `${pct}%`),
};

/**
 * A progress indicator. Renders either a linear bar (`variant="line"`) or a circular
 * ring (`variant="circle"`) showing the fraction `value / max`. It is a display-only,
 * accessible `role="progressbar"` — NOT a form input. The line fill width is driven by
 * a dynamic `--pd-progress-pct` custom property; the circle uses an SVG stroke's
 * `stroke-dasharray`/`stroke-dashoffset`. Set `indeterminate` for an animated,
 * unknown-progress sweep (drops `aria-valuenow`). Configure via JS properties or
 * attributes.
 *
 * @element puredashboard-progress
 *
 * @prop {number}  value         - Current progress in `[0, max]` (clamped). Default `0`.
 * @prop {number}  max           - Upper bound of the range. Default `100`.
 * @prop {string}  variant       - `"line"` (default) | `"circle"`.
 * @prop {string}  status        - `"normal"` (default) | `"success"` (green) | `"error"` (red) — colours the fill and picks the info glyph.
 * @prop {boolean} showInfo      - Show the percent text (or a check/cross glyph for success/error). Default `true`.
 * @prop {boolean} indeterminate - Animate an unknown-progress sweep; omits `aria-valuenow`. Default `false`.
 * @prop {string}  size          - `"sm"` | `"md"` (default) | `"lg"` — track / ring thickness.
 * @prop {Object}  labels        - Override UI strings. Keys: `label(pct)`. Unset keys keep the English default.
 *
 * @cssprop [--pd-progress-line-h]    - Line track thickness (defaults per `size`).
 * @cssprop [--pd-progress-circle]    - Circle diameter (defaults per `size`).
 * @cssprop [--pd-progress-circle-sw] - Circle stroke width (defaults per `size`).
 *
 * @example
 * const pr = document.createElement("puredashboard-progress");
 * pr.value = 40; pr.max = 100;               // 40%
 * document.body.append(pr);
 * pr.variant = "circle"; pr.status = "success";   // green ring + check
 * pr.indeterminate = true;                        // animated sweep, no value
 */
class PuredashboardProgress extends Reactive {
  static properties = {
    value: {}, max: {}, variant: {}, status: {}, showInfo: {}, indeterminate: {}, size: {}, labels: {},
  };

  // Reflect declarative HTML attributes into reactive properties, so the control can be
  // configured the natural way — <puredashboard-progress value="30" max="60" variant="circle">
  // — not only via JS. Boolean attrs map by presence; numeric attrs coerce to Number.
  static observedAttributes = ["value", "max", "variant", "status", "size", "showinfo", "indeterminate"];
  attributeChangedCallback(name, _old, val) {
    if (name === "showinfo") { this.showInfo = val !== null; return; }
    if (name === "indeterminate") { this.indeterminate = val !== null; return; }
    const num = name === "value" || name === "max";
    this[name] = num ? (val == null ? val : Number(val)) : val;
  }

  // _label(key, …args) → localised string: this.labels override, else the default.
  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  setup() {
    if (this.value == null) this.value = 0;
    if (this.max == null) this.max = 100;
    if (this.showInfo == null) this.showInfo = true;
  }

  // Fraction [0..1] of value within [0, max]. Clamped and guarded against a zero/negative
  // range so a stray max never produces NaN or an out-of-bounds fill.
  _frac() {
    const max = Number(this.max);
    const cur = Number(this.value);
    if (!Number.isFinite(cur) || !Number.isFinite(max) || max <= 0) return 0;
    return Math.max(0, Math.min(1, cur / max));
  }
  // Rounded percent [0..100] for display and aria.
  _pct() { return Math.round(this._frac() * 100); }

  // Keep the line-fill percent in sync via the dynamic inline custom property (mirrors
  // slider.js). Harmless for the circle variant.
  updated() { this.style.setProperty("--pd-progress-pct", `${this._pct()}%`); }

  _statusCls() { return this.status === "success" || this.status === "error" ? ` puredashboard-progress__fill--${this.status}` : ""; }

  // The info affordance: a check on success, a cross on error, else the rounded percent.
  _info() {
    if (this.status === "success") return html`<span class="puredashboard-progress__glyph puredashboard-progress__glyph--success">${checkGlyph}</span>`;
    if (this.status === "error") return html`<span class="puredashboard-progress__glyph puredashboard-progress__glyph--error">${crossGlyph}</span>`;
    return html`<span class="puredashboard-progress__text">${this.indeterminate ? "" : this._pct() + "%"}</span>`;
  }

  render() {
    const indet = !!this.indeterminate;
    const pct = this._pct();
    const max = Number(this.max) || 0;
    const sizeCls = this.size === "sm" ? " puredashboard-progress--sm" : this.size === "lg" ? " puredashboard-progress--lg" : "";
    const variantCls = this.variant === "circle" ? " puredashboard-progress--circle" : " puredashboard-progress--line";
    const indetCls = indet ? " puredashboard-progress--indeterminate" : "";
    const statusCls = this._statusCls();
    const showInfo = this.showInfo !== false;

    // a11y: role=progressbar + min/max always; valuenow only when determinate.
    const aria = {
      role: "progressbar",
      min: "0",
      max: String(max),
      now: indet ? null : String(this.value ?? 0),
      label: this._label("label", indet ? null : pct),
    };

    const wrapCls = `puredashboard-progress__wrap${variantCls}${sizeCls}${indetCls}`;

    if (this.variant === "circle") {
      // Ring geometry: a fixed viewBox radius; dasharray = full circumference, dashoffset
      // shrinks the visible arc to the fraction. (For indeterminate, CSS rotates a fixed
      // short arc instead.)
      const R = 42, C = 2 * Math.PI * R;
      const offset = indet ? C * 0.75 : C * (1 - this._frac());
      return html`
        <div class="${wrapCls}" role="${aria.role}" aria-label="${aria.label}" aria-valuemin="${aria.min}" aria-valuemax="${aria.max}" aria-valuenow="${aria.now}">
          <svg class="puredashboard-progress__svg" viewBox="0 0 100 100">
            <circle class="puredashboard-progress__ring-bg" cx="50" cy="50" r="${R}"></circle>
            <circle class="puredashboard-progress__ring-fill${statusCls}" cx="50" cy="50" r="${R}" style="stroke-dasharray:${C};stroke-dashoffset:${offset}"></circle>
          </svg>
          ${showInfo ? html`<span class="puredashboard-progress__info">${this._info()}</span>` : ""}
        </div>`;
    }

    // Line: rounded track + fill; width from the dynamic custom property.
    return html`
      <div class="${wrapCls}" role="${aria.role}" aria-label="${aria.label}" aria-valuemin="${aria.min}" aria-valuemax="${aria.max}" aria-valuenow="${aria.now}">
        <div class="puredashboard-progress__track">
          <div class="puredashboard-progress__fill${statusCls}" style="width:${indet ? "" : pct + "%"}"></div>
        </div>
        ${showInfo ? html`<span class="puredashboard-progress__info">${this._info()}</span>` : ""}
      </div>`;
  }
}
PuredashboardProgress.define("puredashboard-progress");

export { PuredashboardProgress };
