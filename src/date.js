// <puredashboard-date> — a form-associated date input.
// Zero-dep, no build, CSP-safe. Built on the Reactive base.
//
// This is input.js specialised to dates: it wraps a NATIVE <input type="date">
// (so the browser supplies the calendar picker, the keyboard, locale-aware
// formatting, and min/max/required constraint validation for free — the
// lowest-risk, most accessible option) and mirrors that inner input's native
// validity onto the host's ElementInternals so the surrounding <form> validates
// it like any built-in field. It is deliberately NOT a hand-built calendar.
//
// Class naming (BEM, block = the component tag): every style class is namespaced
// `puredashboard-date__<element>[--<modifier>]`; script hooks are SEPARATE `js-…`
// classes (never restyle or remove those). Themed through the shared design tokens
// (--control-height-*, --control-pad-x, --focus-ring, --radius, --border, --panel,
// --text, --danger-bg, --disabled-opacity) via a --pd-* fallback chain so it looks
// right with NO theme linked. See docs/DEVELOPMENT.md → "Definition of Done".
import { Reactive, html, labelIdFor } from "./reactive.js";

// All user-facing strings live here (English defaults). Override any subset via
// the `labels` property to localise — e.g. d.labels = { required: "Bắt buộc" }.
// Function-valued keys interpolate.
const LABELS = {
  required: "This field is required.",
};

let uid = 0;

/**
 * A form-associated date input. Wraps a native `<input type="date">` (so the
 * calendar picker, keyboard navigation, locale formatting and `min`/`max`/
 * `required` constraint validation are inherited from the browser) and
 * participates in a surrounding `<form>` natively via `ElementInternals` — it
 * submits under its `name` and validates like a built-in field. Values are ISO
 * `yyyy-mm-dd` strings, matching the native input's `value`. Configure via JS
 * properties or declarative attributes.
 *
 * @element puredashboard-date
 *
 * @prop {string}  value    - Current value as an ISO `yyyy-mm-dd` string (get/set), mirroring the inner field. Default `""`.
 * @prop {string}  min      - Earliest allowed date, ISO `yyyy-mm-dd` (`rangeUnderflow`). Default unset.
 * @prop {string}  max      - Latest allowed date, ISO `yyyy-mm-dd` (`rangeOverflow`). Default unset.
 * @prop {boolean} disabled - Disable the control. Default `false`.
 * @prop {boolean} required - Mark required (empty → `valueMissing`). Default `false`.
 * @prop {boolean} readonly - Read-only. Default `false`.
 * @prop {string}  size     - `"sm"` | `"md"` | `"lg"`. Default `"md"`.
 * @prop {boolean} invalid  - Force the invalid visual state. Default `false`.
 * @prop {string}  error    - Inline error message; shown below and set as a custom validity. Default `""`.
 * @prop {Object}  labels   - Override UI strings. Keys: `required`. Unset keys keep the English default.
 * @attr {string}  name     - Field name for native `<form>` submission.
 * @attr {string}  aria-label - Accessible name for the control. The host has no role of its own, so it is MIRRORED onto the inner native control (as is `aria-labelledby`, and any `<label>` associated with the host) — that mirrored value is what a screen reader announces.
 *
 * @fires input  - Native, bubbling `input` from the inner field (per edit). Read `.value` / `event.target.value`.
 * @fires change - Native, bubbling `change` from the inner field (commit). Read `.value` / `event.target.value`.
 *
 * @method focus - `focus() => void` — focus the inner input.
 *
 * @cssprop [--pd-date-height] - Control height (defaults to `--control-height-md`).
 * @cssprop [--pd-date-pad-x]  - Horizontal padding (defaults to `--control-pad-x`).
 *
 * @example
 * const d = document.createElement("puredashboard-date");
 * d.min = "2020-01-01"; d.max = "2030-12-31"; d.required = true;
 * d.setAttribute("name", "born");
 * d.addEventListener("change", (e) => console.log(e.target.value));
 * form.append(d);
 */
class PuredashboardDate extends Reactive {
  static formAssociated = true;
  static properties = {
    value: {}, min: {}, max: {}, disabled: {}, required: {},
    readonly: {}, size: {}, invalid: {}, error: {}, labels: {},
  };

  constructor() {
    super();
    // ElementInternals is optional (unsupported in jsdom) — guard so the element
    // still renders and syncs its value even where form-association is absent.
    try { this._internals = this.attachInternals(); } catch { this._internals = null; }
    this._errId = `js-puredashboard-date__error-${++uid}`;
  }

  // Reflect declarative HTML attributes into reactive properties, so the control
  // can be configured the natural way inside a form — <puredashboard-date
  // min="2020-01-01" max="2030-12-31" required> — not only via JS. Boolean attrs
  // map by presence; min/max/value stay ISO strings.
  static observedAttributes = ["value", "min", "max", "disabled", "required", "size", "name", "aria-label", "aria-labelledby"];
  attributeChangedCallback(name, _old, val) {
    if (name.startsWith("aria-")) { this.requestUpdate(); return; }   // mirrored onto the inner control in render()
    // `name` is a plain reflected attribute consumed by ElementInternals for form
    // submission; it isn't a reactive property, so leave it on the host attribute.
    if (name === "name") return;
    const bool = name === "disabled" || name === "required";
    this[name] = bool ? val !== null : val;
  }

  // _label(key, …args) → localised string: this.labels override, else the default.
  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  setup() {
    this._default = this.getAttribute("value") ?? "";
    if (this.value == null) this.value = this._default;
    // The inner <input> fires native `input`/`change` that bubble through the host
    // unchanged — the idiomatic, framework-agnostic API (consumers read `.value`
    // or `event.target.value`). We only mirror the value into our state so the
    // property, the owning <form>, and validity stay in sync. No re-dispatch — that
    // would double-deliver the event under its native name.
    const sync = (e, el) => { this.value = el.value; };
    this.on("input", ".js-puredashboard-date__field", sync);
    this.on("change", ".js-puredashboard-date__field", sync);
  }

  // Form-associated lifecycle.
  formResetCallback() { this.value = this._default ?? ""; }
  formDisabledCallback(disabled) { this.disabled = disabled; }
  get form() { return this._internals ? this._internals.form : null; }
  get validity() { return this._internals ? this._internals.validity : null; }
  checkValidity() { return this._internals ? this._internals.checkValidity() : true; }
  focus() { this.$(".js-puredashboard-date__field")?.focus(); }

  _field() { return this.$(".js-puredashboard-date__field"); }

  // Push the current value + validity into the owning <form> after every render.
  // Mirror the native input's own validity (valueMissing, rangeUnderflow/Overflow
  // from min/max, badInput) so the <form> sees exactly what the browser computes;
  // an explicit `error` overrides it as a customError.
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
    const sizeCls = this.size === "sm" ? " puredashboard-date__field--sm" : this.size === "lg" ? " puredashboard-date__field--lg" : "";
    return html`
      <input class="puredashboard-date__field js-puredashboard-date__field${sizeCls}" type="date" aria-label="${this._ariaName()}" aria-labelledby="${this._ariaNamedBy()}" .value="${this.value ?? ""}" min="${this.min ?? ""}" max="${this.max ?? ""}" ?disabled="${!!this.disabled}" ?required="${!!this.required}" ?readonly="${!!this.readonly}" aria-invalid="${invalid ? "true" : "false"}" aria-describedby="${this.error ? this._errId : ""}">
      ${this.error ? html`<div class="puredashboard-date__error" id="${this._errId}" role="alert">${this.error}</div>` : ""}`;
  }
}
PuredashboardDate.define("puredashboard-date");

export { PuredashboardDate };
