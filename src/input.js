// <puredashboard-input> — a form-associated single-line text input.
// Zero-dep, no build, CSP-safe. Built on the Reactive base.
//
// This is the CANONICAL reference component for the input family: it shows the
// pattern every other control (select, checkbox, switch, slider, …) follows —
// form-associated via ElementInternals (native <form> submit + constraint
// validation), state in `static properties`, all strings in a `LABELS` map, BEM
// classes namespaced by the tag, script hooks as SEPARATE `js-…` classes, and
// theming through the shared design tokens (--control-height-*, --focus-ring,
// --radius, --danger-bg, …) with a --pd-* fallback chain so it works with no
// theme linked. See docs/DEVELOPMENT.md → "Definition of Done".
//
// It wraps a native <input> so browser behaviour (caret, IME, autofill,
// type=email/number constraints) is inherited, and mirrors that inner input's
// native validity onto the host's ElementInternals so the surrounding <form>
// validates it like any built-in field. The Reactive parts engine diffs in
// place, so the caret and selection survive re-renders.
import { Reactive, html, labelIdFor } from "./reactive.js";

// All user-facing strings live here (English defaults). Override any subset via
// the `labels` property to localise — e.g. inp.labels = { required: "Bắt buộc" }.
// Function-valued keys interpolate.
const LABELS = {
  required: "This field is required.",
};

let uid = 0;

/**
 * A form-associated single-line text input. Wraps a native `<input>` (so caret,
 * IME, autofill and `type`-based validation are inherited) and participates in a
 * surrounding `<form>` natively via `ElementInternals` — it submits under its
 * `name` and validates like a built-in field. Configure via JS properties.
 *
 * @element puredashboard-input
 *
 * @prop {string}  value       - Current value (get/set). Default `""`.
 * @prop {string}  type        - Native input type (`text`/`email`/`password`/`number`/`search`/`tel`/`url`). Default `"text"`.
 * @prop {string}  placeholder - Placeholder text. Default `""`.
 * @prop {boolean} disabled    - Disable the control. Default `false`.
 * @prop {boolean} required    - Mark required (empty → `valueMissing`). Default `false`.
 * @prop {boolean} readonly    - Read-only. Default `false`.
 * @prop {string}  size        - `"sm"` | `"md"` | `"lg"`. Default `"md"`.
 * @prop {boolean} invalid     - Force the invalid visual state. Default `false`.
 * @prop {string}  error       - Inline error message; shown below and set as a custom validity. Default `""`.
 * @prop {Object}  labels      - Override UI strings. Keys: `required`. Unset keys keep the English default.
 * @attr {string}  name        - Field name for native `<form>` submission.
 * @attr {string}  aria-label - Accessible name for the control. The host has no role of its own, so it is MIRRORED onto the inner native control (as is `aria-labelledby`, and any `<label>` associated with the host) — that mirrored value is what a screen reader announces.
 *
 * @fires input  - Native, bubbling `input` from the inner field (per keystroke). Read `.value` / `event.target.value`.
 * @fires change - Native, bubbling `change` from the inner field (blur/enter). Read `.value` / `event.target.value`.
 *
 * @method focus - `focus() => void` — focus the inner input.
 *
 * @cssprop [--pd-input-height] - Control height (defaults to `--control-height-md`).
 * @cssprop [--pd-input-pad-x]  - Horizontal padding (defaults to `--control-pad-x`).
 *
 * @example
 * const inp = document.createElement("puredashboard-input");
 * inp.type = "email"; inp.required = true; inp.placeholder = "you@example.com";
 * inp.setAttribute("name", "email");
 * inp.addEventListener("change", (e) => console.log(e.detail.value));
 * form.append(inp);
 */
class PuredashboardInput extends Reactive {
  static formAssociated = true;
  static properties = {
    value: {}, type: {}, placeholder: {}, disabled: {}, required: {},
    readonly: {}, size: {}, invalid: {}, error: {}, labels: {},
  };

  constructor() {
    super();
    try { this._internals = this.attachInternals(); } catch { this._internals = null; }
    this._errId = `js-puredashboard-input__error-${++uid}`;
  }

  // Reflect declarative HTML attributes into reactive properties, so the control
  // can be configured the natural way inside a form — <puredashboard-input
  // type="email" required> — not only via JS. Boolean attrs map by presence.
  static observedAttributes = ["value", "type", "placeholder", "size", "disabled", "required", "readonly", "aria-label", "aria-labelledby"];
  attributeChangedCallback(name, _old, val) {
    if (name.startsWith("aria-")) { this.requestUpdate(); return; }   // mirrored onto the inner control in render()
    const bool = name === "disabled" || name === "required" || name === "readonly";
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
    this.on("input", ".js-puredashboard-input__field", sync);
    this.on("change", ".js-puredashboard-input__field", sync);
  }

  // Form-associated lifecycle.
  formResetCallback() { this.value = this._default ?? ""; }
  formDisabledCallback(disabled) { this.disabled = disabled; }
  get form() { return this._internals ? this._internals.form : null; }
  get validity() { return this._internals ? this._internals.validity : null; }
  checkValidity() { return this._internals ? this._internals.checkValidity() : true; }
  focus() { this.$(".js-puredashboard-input__field")?.focus(); }

  _field() { return this.$(".js-puredashboard-input__field"); }

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
    const sizeCls = this.size === "sm" ? " puredashboard-input__field--sm" : this.size === "lg" ? " puredashboard-input__field--lg" : "";
    return html`
      <input class="puredashboard-input__field js-puredashboard-input__field${sizeCls}" type="${this.type || "text"}" .value="${this.value ?? ""}" placeholder="${this.placeholder || ""}" ?disabled="${!!this.disabled}" ?required="${!!this.required}" ?readonly="${!!this.readonly}" aria-invalid="${invalid ? "true" : "false"}" aria-describedby="${this.error ? this._errId : ""}" aria-label="${this._ariaName()}" aria-labelledby="${this._ariaNamedBy()}">
      ${this.error ? html`<div class="puredashboard-input__error" id="${this._errId}" role="alert">${this.error}</div>` : ""}`;
  }
}
PuredashboardInput.define("puredashboard-input");

export { PuredashboardInput };
