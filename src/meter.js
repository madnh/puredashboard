// <puredashboard-meter> — a gauge for a MEASUREMENT inside a known range (disk used,
// memory, quota, a score). Zero-dep, no build, CSP-safe. Built on the Reactive base.
//
// Not to be confused with its neighbour <puredashboard-progress>: progress reports how
// far a TASK has got and only ever grows toward completion; a meter reports a static
// reading that can move either way and has no notion of "done". That difference is the
// whole reason both exist — it is also the ARIA difference (role="meter" vs
// role="progressbar"), and screen readers announce them differently.
//
// Shape: an optional label row (label left, formatted value right) above a rounded
// track whose fill WIDTH comes from a DYNAMIC inline custom property (--pd-meter-pct),
// exactly like progress.js / slider.js paint theirs (allowed by the CSP style policy —
// it is a computed value, not a stylesheet).
//
// Colour zones follow the NATIVE <meter> element's low/high/optimum semantics, so an
// author's intuition transfers: leave them unset for a single accent-coloured bar, or
// set them to have the bar turn green / amber / red on its own. See _zone().
//
// Class naming (BEM, block = the component tag); nothing is interactive, so there are no
// `js-` hooks. Themed through the shared tokens (--accent/--green/--amber/--red,
// --panel-3, --radius-full, --text/--muted, --font-size-sm, --duration-*) via a --pd-*
// fallback chain, so it looks right with NO theme linked. All user-facing strings live
// in a LABELS map. See docs/DEVELOPMENT.md → "Definition of Done".
import { Reactive, html } from "./reactive.js";

let uid = 0;

// All user-facing strings live here (English defaults). Override any subset via the
// `labels` property to localise — e.g. m.labels = { meter: "Dung lượng" }.
// Function-valued keys interpolate. NB: `label` is author CONTENT (a property), not a
// fixed string, so it is never a LABELS key.
const LABELS = {
  // Fallback accessible name when the meter has neither a `label` nor an aria-label.
  meter: "Meter",
  // What a screen reader announces for the reading (aria-valuetext). Gets the formatted
  // value, the raw number and the percent of the range.
  valueText: (formatted) => formatted,
};

/**
 * A meter: a gauge showing where a MEASUREMENT sits inside a known range — disk used,
 * memory, quota, a score. Display-only and NOT a form input, so it is not
 * form-associated. Renders an accessible `role="meter"` (`aria-valuenow`/`min`/`max` +
 * `aria-valuetext`) with an optional label row above the track.
 *
 * **Meter or progress?** A meter reports a reading that can move up or down and is never
 * "complete"; `<puredashboard-progress>` reports how far a task has advanced. Screen
 * readers announce the two differently — pick by meaning, not by looks.
 *
 * Set `low`/`high`/`optimum` to get the native `<meter>` element's colour zones: the bar
 * turns green in the optimum region, amber when suboptimal, red when it is in the region
 * furthest from `optimum`. Leave them unset for a plain accent-coloured bar.
 *
 * @element puredashboard-meter
 *
 * @prop {number} value      - The current reading, clamped into `[min, max]`. Default `0`.
 * @prop {number} min        - Lower bound of the range. Default `0`.
 * @prop {number} max        - Upper bound of the range. Default `100`.
 * @prop {number} low        - Upper edge of the "low" region (`min ≤ low ≤ high`). Unset = no zones.
 * @prop {number} high       - Lower edge of the "high" region (`low ≤ high ≤ max`). Unset = no zones.
 * @prop {number} optimum    - Where the ideal reading sits; decides which region is green. Unset = no zones.
 * @prop {string|Node} label - Visible label shown left of the value; also becomes the meter's accessible name. A string is escaped; a node / nested `html` template renders as-is. Default `""`.
 * @prop {boolean} showValue - Show the formatted reading on the right of the label row. Default `true`.
 * @prop {Object} format     - `Intl.NumberFormat` options for the reading, e.g. `{ style: "unit", unit: "gigabyte" }` or `{ style: "percent" }`. Unset = the percent of the range ("24%").
 * @prop {string} locale     - BCP-47 locale for `format`. Unset = the runtime default.
 * @prop {string} size       - `"sm"` | `"md"` (default) | `"lg"` — track thickness.
 * @prop {Object} labels     - Override UI strings. Keys: `meter` (fallback accessible name), `valueText(formatted, value, pct)`. Unset keys keep the English default.
 *
 * @attr {number}  value      - Declarative form of `value`.
 * @attr {number}  min        - Declarative form of `min`.
 * @attr {number}  max        - Declarative form of `max`.
 * @attr {number}  low        - Declarative form of `low`.
 * @attr {number}  high       - Declarative form of `high`.
 * @attr {number}  optimum    - Declarative form of `optimum`.
 * @attr {string}  label      - Declarative form of `label` (text only).
 * @attr {string}  locale     - Declarative form of `locale`.
 * @attr {string}  size       - Declarative form of `size`.
 * @attr {boolean} show-value - Declarative form of `showValue` (presence = true; use `show-value="false"` to hide).
 * @attr {string}  aria-label - Accessible name, applied to the `role="meter"` element (the host has no role of its own). Wins over `label` and over the built-in `LABELS` name.
 *
 * @cssprop [--pd-meter-h]     - Track thickness (defaults per `size`).
 * @cssprop [--pd-meter-color] - Bar colour (set automatically from the zone when `low`/`high`/`optimum` are given).
 *
 * @example
 * const m = document.createElement("puredashboard-meter");
 * m.label = "Disk used"; m.value = 82; m.max = 100;
 * m.low = 60; m.high = 80; m.optimum = 0;      // green → amber → red as it fills
 * document.body.append(m);
 * // a raw reading with units instead of a percent:
 * m.format = { style: "unit", unit: "gigabyte", maximumFractionDigits: 1 };
 */
class PuredashboardMeter extends Reactive {
  static properties = {
    value: {}, min: {}, max: {}, low: {}, high: {}, optimum: {},
    label: {}, showValue: {}, format: {}, locale: {}, size: {}, labels: {},
  };

  // Reflect declarative HTML attributes into reactive properties, so the meter can be
  // configured the natural way — <puredashboard-meter value="82" low="60" high="80"
  // optimum="0" label="Disk used"> — not only via JS. Numeric attrs coerce to Number.
  static observedAttributes = ["value", "min", "max", "low", "high", "optimum", "label", "locale", "size", "show-value", "aria-label"];
  attributeChangedCallback(name, _old, val) {
    if (name === "aria-label") { this.requestUpdate(); return; }        // read in render()
    if (name === "show-value") { this.showValue = val !== null && val !== "false"; return; }
    const num = ["value", "min", "max", "low", "high", "optimum"].includes(name);
    this[name] = num ? (val == null ? val : Number(val)) : val;
  }

  // _label(key, …args) → localised string: this.labels override, else the default.
  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  setup() {
    if (this.value == null) this.value = 0;
    if (this.min == null) this.min = 0;
    if (this.max == null) this.max = 100;
    if (this.showValue == null) this.showValue = true;
    this._labelId = `pd-meter-l-${++uid}`;
  }

  // The range, guarded so a stray min/max can never produce NaN or a divide-by-zero.
  _range() {
    const min = Number(this.min), max = Number(this.max);
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return { min: 0, max: 100 };
    return { min, max };
  }
  // The reading, clamped into the range.
  _value() {
    const { min, max } = this._range();
    const v = Number(this.value);
    if (!Number.isFinite(v)) return min;
    return Math.max(min, Math.min(max, v));
  }
  _frac() { const { min, max } = this._range(); return (this._value() - min) / (max - min); }
  _pct() { return Math.round(this._frac() * 100); }

  // Colour zone, following the NATIVE <meter> rules (HTML spec "meter element"):
  //   • optimum in the LOW region  → low is optimum, middle suboptimal, high is worst
  //   • optimum in the HIGH region → mirrored
  //   • optimum in the MIDDLE      → middle is optimum, BOTH ends merely suboptimal
  // Zones are opt-in: without low/high/optimum the bar keeps the neutral accent colour.
  _zone() {
    const { min, max } = this._range();
    const low = Number(this.low), high = Number(this.high), opt = Number(this.optimum);
    if (![low, high, opt].every(Number.isFinite)) return "";
    const lo = Math.max(min, Math.min(max, low));
    const hi = Math.max(lo, Math.min(max, high));
    const v = this._value();
    const region = v < lo ? "low" : v > hi ? "high" : "mid";       // which region the READING is in
    const optRegion = opt < lo ? "low" : opt > hi ? "high" : "mid";  // …and which one is ideal
    if (region === optRegion) return "optimum";
    if (optRegion === "mid") return "suboptimal";                  // both ends are equally so-so
    return region === "mid" ? "suboptimal" : "poor";               // opposite end = worst
  }

  // The reading as text: `format` (Intl.NumberFormat options) applied to the RAW value,
  // else the percent of the range. Intl is a browser built-in — no dependency — but a
  // bad options object throws, so fall back to the plain number.
  _formatted() {
    const v = this._value();
    const fmt = this.format;
    if (fmt && typeof fmt === "object") {
      try { return new Intl.NumberFormat(this.locale || undefined, fmt).format(v); } catch { return String(v); }
    }
    try { return new Intl.NumberFormat(this.locale || undefined, { style: "percent", maximumFractionDigits: 0 }).format(this._frac()); }
    catch { return `${this._pct()}%`; }
  }

  // Keep the fill width in sync via the dynamic inline custom property (mirrors
  // progress.js / slider.js — a computed value, so CSP-safe).
  updated() { this.style.setProperty("--pd-meter-pct", `${this._frac() * 100}%`); }

  render() {
    const { min, max } = this._range();
    const value = this._value();
    const formatted = this._formatted();
    const zone = this._zone();
    const hasLabel = this.label != null && this.label !== "";
    const sizeCls = this.size === "sm" ? " puredashboard-meter--sm" : this.size === "lg" ? " puredashboard-meter--lg" : "";
    const zoneCls = zone ? ` puredashboard-meter__fill--${zone}` : "";
    // Accessible name: an author aria-label wins, else the visible label names it, else
    // the LABELS fallback (a meter with no name tells a screen-reader user nothing).
    const authored = this.getAttribute("aria-label");
    const namedBy = !authored && hasLabel ? this._labelId : "";
    return html`
      <div class="puredashboard-meter__wrap${sizeCls}">
        ${hasLabel || this.showValue !== false ? html`<div class="puredashboard-meter__head">
          ${hasLabel ? html`<span class="puredashboard-meter__label" id="${this._labelId}">${this.label}</span>` : ""}
          ${this.showValue !== false ? html`<span class="puredashboard-meter__value">${formatted}</span>` : ""}
        </div>` : ""}
        <div class="puredashboard-meter__track" role="meter" aria-valuenow="${String(value)}" aria-valuemin="${String(min)}" aria-valuemax="${String(max)}" aria-valuetext="${this._label("valueText", formatted, value, this._pct())}" aria-label="${authored ?? (namedBy ? "" : this._label("meter"))}" aria-labelledby="${namedBy}">
          <div class="puredashboard-meter__fill${zoneCls}"></div>
        </div>
      </div>`;
  }
}
PuredashboardMeter.define("puredashboard-meter");

export { PuredashboardMeter };
