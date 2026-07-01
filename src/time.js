// <puredashboard-time> — a form-associated time picker.
// Zero-dep, no build, CSP-safe. Built on the Reactive base.
//
// This is input.js specialised to time: it wraps a native <input type="time">
// (so the browser's own time spinner / picker, keyboard entry, and
// min/max/step/required constraint validation are ALL inherited — there is no
// custom clock here on purpose) and mirrors that inner input's native validity
// onto the host's ElementInternals so the surrounding <form> validates it like
// any built-in field. The Reactive parts engine diffs in place, so the caret /
// segment focus survive re-renders.
//
// Class naming (BEM, block = the component tag): every style class is namespaced
// `puredashboard-time__<element>[--<modifier>]`; script hooks are SEPARATE `js-…`
// classes (never restyle or remove those). Themed through the shared design tokens
// (--control-height-*, --control-pad-x, --focus-ring, --radius, --border, --panel,
// --text, --danger-bg, …) via a --pd-* fallback chain so it looks right with NO
// theme linked. See docs/DEVELOPMENT.md → "Definition of Done".
import { Reactive, html } from "./reactive.js";

// All user-facing strings live here (English defaults). Override any subset via
// the `labels` property to localise — e.g. t.labels = { required: "Bắt buộc" }.
// Function-valued keys interpolate.
const LABELS = {
  required: "This field is required.",
};

let uid = 0;

/**
 * A form-associated time picker. Wraps a native `<input type="time">` (so the
 * browser's built-in time spinner / picker, keyboard entry, and
 * `min`/`max`/`step`/`required` constraint validation are inherited — no custom
 * clock) and participates in a surrounding `<form>` natively via
 * `ElementInternals` — it submits under its `name` and validates like a built-in
 * field. Configure via JS properties or declarative HTML attributes.
 *
 * @element puredashboard-time
 *
 * @prop {string}  value    - Current time as `HH:mm` (or `HH:mm:ss` when `step` admits seconds), mirroring the inner field. Default `""`.
 * @prop {string}  min      - Earliest allowed time `HH:mm[:ss]` (`rangeUnderflow`). Default unset.
 * @prop {string}  max      - Latest allowed time `HH:mm[:ss]` (`rangeOverflow`). Default unset.
 * @prop {number}  step     - Granularity in seconds (e.g. `60` = minutes, `1` = seconds). Default unset (native default, minutes).
 * @prop {boolean} disabled - Disable the control. Default `false`.
 * @prop {boolean} required - Mark required (empty → `valueMissing`). Default `false`.
 * @prop {boolean} readonly - Read-only. Default `false`.
 * @prop {string}  size     - `"sm"` | `"md"` | `"lg"`. Default `"md"`.
 * @prop {boolean} invalid  - Force the invalid visual state. Default `false`.
 * @prop {string}  error    - Inline error message; shown below and set as a custom validity. Default `""`.
 * @prop {Object}  labels   - Override UI strings. Keys: `required`. Unset keys keep the English default.
 * @attr {string}  name     - Field name for native `<form>` submission.
 *
 * @fires input  - Native, bubbling `input` from the inner field (per edit). Read `.value` / `event.target.value`.
 * @fires change - Native, bubbling `change` from the inner field (commit). Read `.value` / `event.target.value`.
 *
 * @method focus - `focus() => void` — focus the inner input.
 *
 * @cssprop [--pd-time-height] - Control height (defaults to `--control-height-md`).
 * @cssprop [--pd-time-pad-x]  - Horizontal padding (defaults to `--control-pad-x`).
 *
 * @example
 * const t = document.createElement("puredashboard-time");
 * t.min = "09:00"; t.max = "17:00"; t.step = 60; t.required = true;
 * t.setAttribute("name", "start");
 * t.addEventListener("change", (e) => console.log(e.target.value));
 * form.append(t);
 */
class PuredashboardTime extends Reactive {
  static formAssociated = true;
  static properties = {
    value: {}, min: {}, max: {}, step: {}, disabled: {}, required: {},
    readonly: {}, size: {}, invalid: {}, error: {}, labels: {},
  };

  constructor() {
    super();
    try { this._internals = this.attachInternals(); } catch { this._internals = null; }
    this._errId = `js-puredashboard-time__error-${++uid}`;
  }

  // Reflect declarative HTML attributes into reactive properties, so the control
  // can be configured the natural way inside a form — <puredashboard-time
  // min="09:00" max="17:00" step="60" required> — not only via JS. Boolean attrs
  // map by presence; `step` coerces to Number.
  static observedAttributes = ["value", "min", "max", "step", "size", "disabled", "required", "readonly", "name"];
  attributeChangedCallback(name, _old, val) {
    if (name === "name") return; // `name` is read from the attribute directly (native form field name)
    const bool = name === "disabled" || name === "required" || name === "readonly";
    const num = name === "step";
    this[name] = bool ? val !== null : num ? (val == null ? val : Number(val)) : val;
  }

  // _label(key, …args) → localised string: this.labels override, else the default.
  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  setup() {
    this._default = this.getAttribute("value") ?? "";
    if (this.value == null) this.value = this._default;
    // The inner <input> fires native `input`/`change` that bubble through the host
    // unchanged — the idiomatic, framework-agnostic API (consumers read `.value` or
    // `event.target.value`). We only mirror the value into our state so the property,
    // the owning <form>, and validity stay in sync. No re-dispatch — that would
    // double-deliver the event under its native name.
    const sync = (e, el) => { this.value = el.value; };
    this.on("input", ".js-puredashboard-time__field", sync);
    this.on("change", ".js-puredashboard-time__field", sync);
  }

  // Form-associated lifecycle.
  formResetCallback() { this.value = this._default ?? ""; }
  formDisabledCallback(disabled) { this.disabled = disabled; }
  get form() { return this._internals ? this._internals.form : null; }
  get validity() { return this._internals ? this._internals.validity : null; }
  checkValidity() { return this._internals ? this._internals.checkValidity() : true; }
  focus() { this.$(".js-puredashboard-time__field")?.focus(); }

  _field() { return this.$(".js-puredashboard-time__field"); }

  // Push the current value + validity into the owning <form> after every render.
  updated() {
    if (!this._internals || !this._internals.setFormValue) return;
    this._internals.setFormValue(this.value ?? "");
    const field = this._field();
    if (this.error) this._internals.setValidity({ customError: true }, this.error, field || undefined);
    else if (field && field.validity) this._internals.setValidity(field.validity, field.validationMessage, field);
    else this._internals.setValidity({});
  }

  render() {
    const invalid = !!(this.invalid || this.error);
    const sizeCls = this.size === "sm" ? " puredashboard-time__field--sm" : this.size === "lg" ? " puredashboard-time__field--lg" : "";
    return html`
      <input class="puredashboard-time__field js-puredashboard-time__field${sizeCls}" type="time" .value="${this.value ?? ""}" min="${this.min ?? ""}" max="${this.max ?? ""}" step="${this.step ?? ""}" ?disabled="${!!this.disabled}" ?required="${!!this.required}" ?readonly="${!!this.readonly}" aria-invalid="${invalid ? "true" : "false"}" aria-describedby="${this.error ? this._errId : ""}">
      ${this.error ? html`<div class="puredashboard-time__error" id="${this._errId}" role="alert">${this.error}</div>` : ""}`;
  }
}
PuredashboardTime.define("puredashboard-time");

export { PuredashboardTime };
