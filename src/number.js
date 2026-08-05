// <puredashboard-number> — a form-associated numeric input with stepper buttons.
// Zero-dep, no build, CSP-safe. Built on the Reactive base.
//
// This is input.js specialised to numbers: it wraps a native <input type="number">
// (so number semantics, min/max/step constraint validation, mobile numeric keypad
// and caret behaviour are inherited) and flanks it with decrement (−) / increment
// (+) stepper <button>s. Clicking a stepper nudges the value by `step`, clamped to
// [min, max], then drives the change back through the SAME native input/change path
// the keyboard uses — so the owning <form>'s value + validity update identically no
// matter how the value changed.
//
// Class naming (BEM, block = the component tag): every style class is namespaced
// `puredashboard-number__<element>[--<modifier>]`; script hooks are SEPARATE `js-…`
// classes (never restyle or remove those). Themed through the shared design tokens
// (--control-height-*, --focus-ring, --radius, --border, --panel-2, --danger-bg, …)
// via a --pd-* fallback chain so it looks right with NO theme linked. Icons are
// inline self-contained SVG, sized via inline style — no shared icon module.
// See docs/DEVELOPMENT.md → "Definition of Done".
import { Reactive, html, labelIdFor } from "./reactive.js";
import { raw } from "./html.js";

// Inline, self-contained icons — a tiny svg() wrapping raw() from html.js (same
// pattern as upload.js), so the component needs no shared icon class.
const svg = (b) => raw(`<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-.14em;overflow:visible;flex:none" aria-hidden="true">${b}</svg>`);
const minusGlyph = svg('<path d="M5 12h14"/>');
const plusGlyph  = svg('<path d="M12 5v14"/><path d="M5 12h14"/>');

// All user-facing strings live here (English defaults). Override any subset via the
// `labels` property to localise — e.g. num.labels = { increment: "Tăng" }.
// Function-valued keys interpolate.
const LABELS = {
  required: "This field is required.",
  increment: "Increment",
  decrement: "Decrement",
};

let uid = 0;

/**
 * A form-associated numeric input with stepper buttons. Wraps a native
 * `<input type="number">` (so numeric keypad, caret, and `min`/`max`/`step`
 * constraint validation are inherited) flanked by decrement (−) and increment (+)
 * buttons, and participates in a surrounding `<form>` natively via
 * `ElementInternals` — it submits under its `name` and validates like a built-in
 * field. Configure via JS properties.
 *
 * @element puredashboard-number
 *
 * @prop {string}  value       - Current value (get/set), mirroring the inner field. Default `""`.
 * @prop {number}  min         - Minimum allowed value (`rangeUnderflow` + clamps steppers). Default unset.
 * @prop {number}  max         - Maximum allowed value (`rangeOverflow` + clamps steppers). Default unset.
 * @prop {number}  step        - Stepper increment and native step granularity. Default `1`.
 * @prop {string}  placeholder - Placeholder text. Default `""`.
 * @prop {boolean} disabled    - Disable the control. Default `false`.
 * @prop {boolean} required    - Mark required (empty → `valueMissing`). Default `false`.
 * @prop {boolean} readonly    - Read-only (also disables the steppers). Default `false`.
 * @prop {string}  size        - `"sm"` | `"md"` | `"lg"`. Default `"md"`.
 * @prop {boolean} invalid     - Force the invalid visual state. Default `false`.
 * @prop {string}  error       - Inline error message; shown below and set as a custom validity. Default `""`.
 * @prop {Object}  labels      - Override UI strings. Keys: `required`, `increment`, `decrement`. Unset keys keep the English default.
 * @attr {string}  name        - Field name for native `<form>` submission.
 * @attr {string}  aria-label - Accessible name for the control. The host has no role of its own, so it is MIRRORED onto the inner native control (as is `aria-labelledby`, and any `<label>` associated with the host) — that mirrored value is what a screen reader announces.
 *
 * @fires input  - Native, bubbling `input` from the inner field (per keystroke AND per stepper click). Read `.value` / `event.target.value`.
 * @fires change - Native, bubbling `change` from the inner field (blur/enter AND per stepper click). Read `.value` / `event.target.value`.
 *
 * @method focus - `focus() => void` — focus the inner input.
 *
 * @cssprop [--pd-number-height] - Control height (defaults to `--control-height-md`).
 * @cssprop [--pd-number-pad-x]  - Horizontal padding (defaults to `--control-pad-x`).
 *
 * @example
 * const num = document.createElement("puredashboard-number");
 * num.min = 0; num.max = 10; num.step = 2; num.value = "4";
 * num.setAttribute("name", "qty");
 * num.addEventListener("change", (e) => console.log(e.target.value));
 * form.append(num);
 */
class PuredashboardNumber extends Reactive {
  static formAssociated = true;
  static properties = {
    value: {}, min: {}, max: {}, step: {}, placeholder: {}, disabled: {},
    required: {}, readonly: {}, size: {}, invalid: {}, error: {}, labels: {},
  };

  constructor() {
    super();
    try { this._internals = this.attachInternals(); } catch { this._internals = null; }
    this._errId = `js-puredashboard-number__error-${++uid}`;
  }

  // Reflect declarative HTML attributes into reactive properties, so the control
  // can be configured the natural way inside a form — <puredashboard-number
  // min="0" max="10" step="2" required> — not only via JS. Boolean attrs map by
  // presence; numeric attrs (min/max/step) coerce to Number.
  static observedAttributes = ["value", "min", "max", "step", "placeholder", "size", "disabled", "required", "readonly", "aria-label", "aria-labelledby"];
  attributeChangedCallback(name, _old, val) {
    if (name.startsWith("aria-")) { this.requestUpdate(); return; }   // mirrored onto the inner control in render()
    const bool = name === "disabled" || name === "required" || name === "readonly";
    const num = name === "min" || name === "max" || name === "step";
    this[name] = bool ? val !== null : num ? (val == null ? val : Number(val)) : val;
  }

  // _label(key, …args) → localised string: this.labels override, else the default.
  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  setup() {
    this._default = this.getAttribute("value") ?? "";
    if (this.value == null) this.value = this._default;
    if (this.step == null) this.step = 1;
    // The inner <input> fires native `input`/`change` that bubble through the host
    // unchanged — the idiomatic, framework-agnostic API (consumers read `.value` or
    // `event.target.value`). We only mirror the value into our state so the property,
    // the owning <form>, and validity stay in sync. No re-dispatch — that would
    // double-deliver the event under its native name.
    const sync = (e, el) => { this.value = el.value; };
    this.on("input", ".js-puredashboard-number__field", sync);
    this.on("change", ".js-puredashboard-number__field", sync);
  }

  // Form-associated lifecycle.
  formResetCallback() { this.value = this._default ?? ""; }
  formDisabledCallback(disabled) { this.disabled = disabled; }
  get form() { return this._internals ? this._internals.form : null; }
  get validity() { return this._internals ? this._internals.validity : null; }
  checkValidity() { return this._internals ? this._internals.checkValidity() : true; }
  focus() { this.$(".js-puredashboard-number__field")?.focus(); }

  _field() { return this.$(".js-puredashboard-number__field"); }

  // Step the value by ±step, clamped to [min, max], then drive it back through the
  // NATIVE input/change path so consumers and the <form> see exactly what a keyboard
  // edit produces. We set the inner input's value and dispatch ONE `input` then ONE
  // `change` on it — the delegated `sync` above updates this.value, and both events
  // bubble through the host once each (no host-level re-dispatch).
  _step(dir) {
    if (this.disabled || this.readonly) return;
    const field = this._field();
    if (!field) return;
    const step = Number(this.step) || 1;
    const cur = field.value === "" ? (this.min != null ? Number(this.min) : 0) : Number(field.value);
    const base = Number.isFinite(cur) ? cur : 0;
    let next = base + dir * step;
    next = this._clamp(next);
    // Trim float noise (0.1 + 0.2 …) to a sane precision before stringifying.
    const s = String(Number(next.toFixed(10)));
    if (s === field.value) return;
    field.value = s;
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // Clamp n into [min, max] when those bounds are set.
  _clamp(n) {
    if (this.min != null && n < Number(this.min)) n = Number(this.min);
    if (this.max != null && n > Number(this.max)) n = Number(this.max);
    return n;
  }

  // Should the −/+ button be disabled? Always when the control is disabled/readonly,
  // and when a further step in that direction would exceed the corresponding bound.
  _atBound(dir) {
    if (this.disabled || this.readonly) return true;
    // Use the reactive `value` (source of truth during render) — the inner field's
    // .value binding may not be applied yet when render() computes disabled state.
    const raw = this.value === "" || this.value == null ? NaN : Number(this.value);
    if (!Number.isFinite(raw)) return false; // empty/unknown → allow stepping
    if (dir < 0 && this.min != null) return raw <= Number(this.min);
    if (dir > 0 && this.max != null) return raw >= Number(this.max);
    return false;
  }

  // Push the current value + validity into the owning <form> after every render.
  updated() {
    if (!this._internals || !this._internals.setFormValue) return;
    this._internals.setFormValue(this.value ?? "");
    const field = this._field();
    if (this.error) this._internals.setValidity({ customError: true }, this.error, field || undefined);
    else if (field && field.validity) this._internals.setValidity(field.validity, field.validationMessage, field);
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
    for (const l of labels) ids.push(labelIdFor(l));
    return ids.join(" ");
  }

  render() {
    const invalid = !!(this.invalid || this.error);
    const sizeCls = this.size === "sm" ? " puredashboard-number__control--sm" : this.size === "lg" ? " puredashboard-number__control--lg" : "";
    const decDisabled = this._atBound(-1);
    const incDisabled = this._atBound(1);
    return html`
      <div class="puredashboard-number__control${sizeCls}">
        <button class="puredashboard-number__step puredashboard-number__step--dec js-puredashboard-number__dec" type="button" tabindex="-1" aria-label="${this._label("decrement")}" ?disabled="${decDisabled}" @click="${() => this._step(-1)}">${minusGlyph}</button>
        <input class="puredashboard-number__field js-puredashboard-number__field" type="number" inputmode="decimal" aria-label="${this._ariaName()}" aria-labelledby="${this._ariaNamedBy()}" .value="${this.value ?? ""}" min="${this.min ?? ""}" max="${this.max ?? ""}" step="${this.step ?? 1}" placeholder="${this.placeholder || ""}" ?disabled="${!!this.disabled}" ?required="${!!this.required}" ?readonly="${!!this.readonly}" aria-invalid="${invalid ? "true" : "false"}" aria-describedby="${this.error ? this._errId : ""}">
        <button class="puredashboard-number__step puredashboard-number__step--inc js-puredashboard-number__inc" type="button" tabindex="-1" aria-label="${this._label("increment")}" ?disabled="${incDisabled}" @click="${() => this._step(1)}">${plusGlyph}</button>
      </div>
      ${this.error ? html`<div class="puredashboard-number__error" id="${this._errId}" role="alert">${this.error}</div>` : ""}`;
  }
}
PuredashboardNumber.define("puredashboard-number");

export { PuredashboardNumber };
