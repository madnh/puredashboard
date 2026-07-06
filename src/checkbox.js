// <puredashboard-checkbox> — a form-associated boolean checkbox.
// Zero-dep, no build, CSP-safe. Built on the Reactive base.
//
// Follows the same pattern as the canonical <puredashboard-input> (input.js):
// form-associated via ElementInternals (native <form> submit + constraint
// validation), state in `static properties`, fixed strings in a `LABELS` map,
// BEM classes namespaced by the tag, script hooks as SEPARATE `js-…` classes,
// and theming through the shared design tokens (--control-height-*, --focus-ring,
// --radius, --danger-bg, …) with a --pd-* fallback chain so it works with no
// theme linked. See docs/DEVELOPMENT.md → "Definition of Done".
//
// It wraps a native <input type="checkbox"> so keyboard toggling (Space),
// focus and the role=checkbox / aria-checked semantics (including "mixed" for
// the indeterminate state) are inherited from the browser, and mirrors the inner
// checkbox's `checked` onto the host so the property, the owning <form> value and
// validity stay in sync. The Reactive parts engine diffs in place.
import { Reactive, html } from "./reactive.js";

// All FIXED user-facing strings live here (English defaults). Override any subset
// via the `labels` property to localise — e.g. cb.labels = { required: "Bắt buộc" }.
// Function-valued keys interpolate. NB: the text shown BESIDE the box is author
// CONTENT, not a fixed string, so it is the `label` property — not a LABELS key.
const LABELS = {
  required: "This field is required.",
};

let uid = 0;

/**
 * A form-associated boolean checkbox. Wraps a native `<input type="checkbox">`
 * (so Space-to-toggle, focus and the `role=checkbox` / `aria-checked` semantics —
 * including `"mixed"` for the indeterminate state — are inherited) and
 * participates in a surrounding `<form>` natively via `ElementInternals` — it
 * submits its `value` under its `name` when checked, and validates like a
 * built-in field. Configure via JS properties or declarative attributes.
 *
 * @element puredashboard-checkbox
 *
 * @prop {boolean} checked       - Whether the box is checked (get/set). Default `false`.
 * @prop {boolean} indeterminate - Tri-state visual; sets the inner input's `.indeterminate` property (no HTML attribute). Default `false`.
 * @prop {boolean} disabled      - Disable the control. Default `false`.
 * @prop {boolean} required      - Must be checked to be valid (unchecked → `valueMissing`). Default `false`.
 * @prop {string}  value         - Value submitted when checked. Default `"on"`.
 * @prop {string|Node} label     - Content shown beside the box: a string (auto-escaped) OR a DOM node / nested `html` template / array — pass a node or template to embed a custom element (you build it, you own its safety; plain strings stay escaped). Default `""`.
 * @prop {string}  error         - Inline error message; shown below and set as a custom validity. Default `""`.
 * @prop {Object}  labels        - Override UI strings. Keys: `required`. Unset keys keep the English default.
 * @attr {string}  name          - Field name for native `<form>` submission.
 *
 * @fires change - Native, bubbling `change` from the inner checkbox (toggle). Read `.checked` / `event.target.checked`.
 * @fires input  - Native, bubbling `input` from the inner checkbox. Read `.checked` / `event.target.checked`.
 *
 * @method focus - `focus() => void` — focus the inner checkbox.
 *
 * @cssprop [--pd-checkbox-size]   - Box size (defaults to a value derived from `--control-height-md`).
 * @cssprop [--pd-checkbox-radius] - Box corner radius (defaults to `--radius-sm`).
 *
 * @example
 * const cb = document.createElement("puredashboard-checkbox");
 * cb.label = "I agree to the terms"; cb.required = true;
 * cb.setAttribute("name", "agree");
 * cb.addEventListener("change", (e) => console.log(e.target.checked));
 * form.append(cb);
 */
class PuredashboardCheckbox extends Reactive {
  static formAssociated = true;
  static properties = {
    checked: {}, indeterminate: {}, disabled: {}, required: {},
    value: {}, label: {}, error: {}, labels: {},
  };

  constructor() {
    super();
    try { this._internals = this.attachInternals(); } catch { this._internals = null; }
    this._errId = `js-puredashboard-checkbox__error-${++uid}`;
  }

  // Reflect declarative HTML attributes into reactive properties, so the control
  // can be configured the natural way inside a form — <puredashboard-checkbox
  // required checked value="yes" label="Agree"> — not only via JS. Boolean attrs
  // map by presence. (indeterminate has no attribute — set the property.)
  static observedAttributes = ["value", "label", "checked", "disabled", "required"];
  attributeChangedCallback(name, _old, val) {
    const bool = name === "checked" || name === "disabled" || name === "required";
    this[name] = bool ? val !== null : val;
  }

  // _label(key, …args) → localised string: this.labels override, else the default.
  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  setup() {
    this._default = this.hasAttribute("checked");
    if (this.checked == null) this.checked = this._default;
    if (this.value == null) this.value = this.getAttribute("value") ?? "on";
    // The inner checkbox fires native `change`/`input` that bubble through the host
    // unchanged — the idiomatic, framework-agnostic API (consumers read `.checked`
    // or `event.target.checked`). We only mirror the checked state into our state so
    // the property, the owning <form>, and validity stay in sync. No re-dispatch —
    // that would double-deliver the event under its native name.
    const sync = (e, el) => { this.checked = el.checked; this.indeterminate = false; };
    this.on("change", ".js-puredashboard-checkbox__box", sync);
    this.on("input", ".js-puredashboard-checkbox__box", sync);
  }

  // Form-associated lifecycle.
  formResetCallback() { this.checked = this._default ?? false; this.indeterminate = false; }
  formDisabledCallback(disabled) { this.disabled = disabled; }
  get form() { return this._internals ? this._internals.form : null; }
  get validity() { return this._internals ? this._internals.validity : null; }
  checkValidity() { return this._internals ? this._internals.checkValidity() : true; }
  focus() { this.$(".js-puredashboard-checkbox__box")?.focus(); }

  _box() { return this.$(".js-puredashboard-checkbox__box"); }

  // Push the current value + validity into the owning <form> after every render.
  // Also set the `.indeterminate` PROPERTY on the inner input — it has no HTML
  // attribute, so it can only be applied imperatively.
  updated() {
    const box = this._box();
    if (box) box.indeterminate = !!this.indeterminate;
    if (!this._internals || !this._internals.setFormValue) return;
    this._internals.setFormValue(this.checked ? (this.value ?? "on") : null);
    if (this.error) this._internals.setValidity({ customError: true }, this.error, box || undefined);
    else if (this.required && !this.checked) this._internals.setValidity({ valueMissing: true }, this._label("required"), box || undefined);
    else this._internals.setValidity({});
  }

  render() {
    const invalid = !!this.error;
    return html`
      <label class="puredashboard-checkbox__label">
        <input class="puredashboard-checkbox__box js-puredashboard-checkbox__box" type="checkbox" .checked="${!!this.checked}" ?disabled="${!!this.disabled}" ?required="${!!this.required}" value="${this.value ?? "on"}" aria-invalid="${invalid ? "true" : "false"}" aria-describedby="${this.error ? this._errId : ""}">
        ${this.label ? html`<span class="puredashboard-checkbox__text">${this.label}</span>` : ""}
      </label>
      ${this.error ? html`<div class="puredashboard-checkbox__error" id="${this._errId}" role="alert">${this.error}</div>` : ""}`;
  }
}
PuredashboardCheckbox.define("puredashboard-checkbox");

export { PuredashboardCheckbox };
