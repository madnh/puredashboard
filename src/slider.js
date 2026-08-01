// <puredashboard-slider> — a form-associated range slider.
// Zero-dep, no build, CSP-safe. Built on the Reactive base.
//
// This is input.js specialised to a bounded numeric range: it WRAPS a native
// <input type="range"> so the correct arrow / Home / End / PageUp-PageDown
// keyboard, focus behaviour and screen-reader value semantics (aria-valuenow /
// aria-valuemin / aria-valuemax) come for free — the lowest-risk, most accessible
// way to ship a slider. The track and thumb are restyled via CSS for BOTH WebKit
// and Firefox; the filled-progress visual is driven by a DYNAMIC inline custom
// property (--pd-slider-pct, allowed by the CSP style policy) that render()/updated()
// keep in sync with the value, so a linear-gradient on the track paints the fill.
//
// Class naming (BEM, block = the component tag): every style class is namespaced
// `puredashboard-slider__<element>[--<modifier>]`; script hooks are SEPARATE `js-…`
// classes (never restyle or remove those). Themed through the shared design tokens
// (--accent, --focus-ring, --border, --panel-2/3, --radius-full, --duration-*,
// --disabled-opacity) via a --pd-* fallback chain so it looks right with NO theme
// linked. All user-facing words live in a LABELS map. See docs/DEVELOPMENT.md →
// "Definition of Done".
import { Reactive, html } from "./reactive.js";

// All user-facing strings live here (English defaults). Override any subset via the
// `labels` property to localise — e.g. sl.labels = { value: (v) => `Giá trị: ${v}` }.
// Function-valued keys interpolate. NOTE: the number itself is the value; any words
// AROUND it (a prefix/label) belong here.
const LABELS = {
  // Accessible label for the value bubble; the numeric value is passed in.
  value: (v) => `Value: ${v}`,
};

// Unique ids for <label>s we have to reference from the inner control's aria-labelledby.
let labelId = 0;

/**
 * A form-associated range slider. Wraps a native `<input type="range">` (so the
 * arrow / Home / End / PageUp-PageDown keyboard, focus and screen-reader value
 * semantics — `aria-valuenow`/`aria-valuemin`/`aria-valuemax` — are inherited) and
 * participates in a surrounding `<form>` natively via `ElementInternals` — it
 * submits under its `name` and validates like a built-in field. The filled portion
 * of the track (up to the thumb) is painted from a dynamic `--pd-slider-pct` custom
 * property kept in sync with the value. Configure via JS properties or attributes.
 *
 * @element puredashboard-slider
 *
 * @prop {string}  value     - Current value (get/set), mirroring the inner range input. Defaults to the midpoint of [min, max].
 * @prop {number}  min       - Minimum value. Default `0`.
 * @prop {number}  max       - Maximum value. Default `100`.
 * @prop {number}  step      - Step granularity. Default `1`.
 * @prop {boolean} disabled  - Disable the control. Default `false`.
 * @prop {boolean} showValue - Render a small non-interactive bubble showing the current value. Default `false`.
 * @prop {Object}  labels    - Override UI strings. Keys: `value`. Unset keys keep the English default.
 * @attr {string}  name      - Field name for native `<form>` submission.
 * @attr {string}  aria-label - Accessible name for the control. The host has no role of its own, so it is MIRRORED onto the inner native control (as is `aria-labelledby`, and any `<label>` associated with the host) — that mirrored value is what a screen reader announces.
 *
 * @fires input  - Native, bubbling `input` from the inner range (per drag/keystroke). Read `.value` / `event.target.value`.
 * @fires change - Native, bubbling `change` from the inner range (commit). Read `.value` / `event.target.value`.
 *
 * @method focus - `focus() => void` — focus the inner range input.
 *
 * @cssprop [--pd-slider-track-h] - Track thickness (defaults to `6px`).
 * @cssprop [--pd-slider-thumb]   - Thumb diameter (defaults to `16px`).
 *
 * @example
 * const sl = document.createElement("puredashboard-slider");
 * sl.min = 0; sl.max = 10; sl.step = 1; sl.value = "4"; sl.showValue = true;
 * sl.setAttribute("name", "volume");
 * sl.addEventListener("input", (e) => console.log(e.target.value));
 * form.append(sl);
 */
class PuredashboardSlider extends Reactive {
  static formAssociated = true;
  static properties = {
    value: {}, min: {}, max: {}, step: {}, disabled: {}, showValue: {}, labels: {},
  };

  constructor() {
    super();
    try { this._internals = this.attachInternals(); } catch { this._internals = null; }
  }

  // Reflect declarative HTML attributes into reactive properties, so the control
  // can be configured the natural way inside a form — <puredashboard-slider
  // min="0" max="10" step="2" value="4"> — not only via JS. Boolean attrs map by
  // presence; numeric attrs (min/max/step) coerce to Number.
  static observedAttributes = ["value", "min", "max", "step", "disabled", "name", "aria-label", "aria-labelledby"];
  attributeChangedCallback(name, _old, val) {
    if (name.startsWith("aria-")) { this.requestUpdate(); return; }   // mirrored onto the inner control in render()
    if (name === "name") return; // native form field name; read live via getAttribute
    const bool = name === "disabled";
    const num = name === "min" || name === "max" || name === "step";
    this[name] = bool ? val !== null : num ? (val == null ? val : Number(val)) : val;
  }

  // _label(key, …args) → localised string: this.labels override, else the default.
  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  setup() {
    if (this.min == null) this.min = 0;
    if (this.max == null) this.max = 100;
    if (this.step == null) this.step = 1;
    // Default to the midpoint so the thumb starts centred rather than pinned left.
    this._default = this.getAttribute("value") ?? String((Number(this.min) + Number(this.max)) / 2);
    if (this.value == null) this.value = this._default;
    // The inner range fires native `input`/`change` that bubble through the host
    // unchanged — the idiomatic, framework-agnostic API (consumers read `.value` or
    // `event.target.value`). We only mirror the value into our state so the property,
    // the owning <form>, the value bubble and the fill percent stay in sync. No
    // re-dispatch — that would double-deliver the event under its native name.
    const sync = (e, el) => { this.value = el.value; };
    this.on("input", ".js-puredashboard-slider__field", sync);
    this.on("change", ".js-puredashboard-slider__field", sync);
  }

  // Form-associated lifecycle.
  formResetCallback() { this.value = this._default ?? String(this.min ?? 0); }
  formDisabledCallback(disabled) { this.disabled = disabled; }
  get form() { return this._internals ? this._internals.form : null; }
  get validity() { return this._internals ? this._internals.validity : null; }
  checkValidity() { return this._internals ? this._internals.checkValidity() : true; }
  focus() { this.$(".js-puredashboard-slider__field")?.focus(); }

  _field() { return this.$(".js-puredashboard-slider__field"); }

  // Percentage [0..100] of the current value within [min, max] — drives the track
  // fill and the bubble position. Clamped and guarded against a zero-width range.
  _pct() {
    const min = Number(this.min), max = Number(this.max);
    const cur = Number(this.value);
    if (!Number.isFinite(cur) || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) return 0;
    const p = ((cur - min) / (max - min)) * 100;
    return Math.max(0, Math.min(100, p));
  }

  // Push the current value + validity into the owning <form> after every render,
  // and keep the fill/bubble percent in sync via the dynamic inline custom property.
  updated() {
    // Dynamic style value (a computed percent) — allowed by the CSP style policy.
    this.style.setProperty("--pd-slider-pct", `${this._pct()}%`);
    if (!this._internals || !this._internals.setFormValue) return;
    this._internals.setFormValue(this.value ?? "");
    const field = this._field();
    if (field && field.validity) this._internals.setValidity(field.validity, field.validationMessage, field);
    else this._internals.setValidity({});
  }

  // Accessible name: the author names this control by putting aria-label /
  // aria-labelledby on the HOST, but the host carries no role — so the name must be
  // mirrored onto the inner native control, which is what assistive tech announces.
  // (Same rule as button.js; unset → empty, which the browser ignores, so a wrapping
  // <label> or the visible label keeps naming the control.)
  _ariaName() { return this.getAttribute("aria-label") ?? ""; }
  // …and a <label> that names the HOST (wrapping it, or label[for=hostId]) is associated
  // with the form-associated element, NOT with the inner control — so mirror it down as
  // aria-labelledby, giving each such <label> an id if it hasn't got one.
  _ariaNamedBy() {
    const explicit = this.getAttribute("aria-labelledby");
    if (explicit) return explicit;
    let labels = null;
    try { labels = this._internals && this._internals.labels; } catch { labels = null; }
    if (!labels || !labels.length) return "";
    const ids = [];
    for (const l of labels) { if (!l.id) l.id = `pd-label-${++labelId}`; ids.push(l.id); }
    return ids.join(" ");
  }

  render() {
    const pct = this._pct();
    return html`
      <div class="puredashboard-slider__control" style="--pd-slider-pct:${pct}%">
        <input class="puredashboard-slider__field js-puredashboard-slider__field" type="range" aria-label="${this._ariaName()}" aria-labelledby="${this._ariaNamedBy()}" .value="${this.value ?? ""}" min="${this.min ?? 0}" max="${this.max ?? 100}" step="${this.step ?? 1}" ?disabled="${!!this.disabled}">
        ${this.showValue ? html`<output class="puredashboard-slider__value" aria-hidden="true">${this.value ?? ""}</output>` : ""}
      </div>`;
  }
}
PuredashboardSlider.define("puredashboard-slider");

export { PuredashboardSlider };
