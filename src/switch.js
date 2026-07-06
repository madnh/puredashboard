// <puredashboard-switch> — a form-associated on/off toggle switch.
// Zero-dep, no build, CSP-safe. Built on the Reactive base.
//
// Follows the input.js pattern (the canonical reference for the input family):
// form-associated via ElementInternals (native <form> submit + constraint
// validation), state in `static properties`, all strings in a `LABELS` map, BEM
// classes namespaced by the tag, script hooks as SEPARATE `js-…` classes, and
// theming through the shared design tokens (--control-height-*, --focus-ring,
// --radius, --accent, --duration-*, --disabled-opacity, …) with a --pd-* fallback
// chain so it works with no theme linked. See docs/DEVELOPMENT.md → "Definition of Done".
//
// The visual is a sliding track + knob built entirely in CSS. It WRAPS a native
// <input type="checkbox"> carrying role="switch", so keyboard (Space toggles),
// focus, and the screen-reader "switch" announcement are all native. The inner
// input is visually hidden but stays focusable (a js- class + the standard clip
// technique, never display:none which would remove it from the tab order). The
// element mirrors the inner checkbox's native validity onto the host's
// ElementInternals so the surrounding <form> validates it like a built-in field.
import { Reactive, html } from "./reactive.js";

// All user-facing strings live here (English defaults). Override any subset via
// the `labels` property to localise — e.g. sw.labels = { required: "Bắt buộc" }.
// Function-valued keys interpolate.
const LABELS = {
  required: "This field is required.",
};

let uid = 0;

/**
 * A form-associated on/off toggle switch. Wraps a native `<input type="checkbox">`
 * with `role="switch"` (so Space toggles, focus and the "switch" announcement are
 * inherited) and participates in a surrounding `<form>` natively via
 * `ElementInternals` — it submits under its `name` when on, and validates like a
 * built-in field. Configure via JS properties or declarative attributes.
 *
 * @element puredashboard-switch
 *
 * @prop {boolean} checked  - Whether the switch is on (get/set). Default `false`.
 * @prop {boolean} disabled - Disable the control. Default `false`.
 * @prop {boolean} required - Mark required (must be on → `valueMissing`). Default `false`.
 * @prop {string}  value    - Value submitted when on. Default `"on"`.
 * @prop {string|Node} label - Content shown beside the switch: a string (auto-escaped) OR a DOM node / nested `html` template / array — pass a node or template to embed a custom element (you build it, you own its safety; plain strings stay escaped). Default `""`.
 * @prop {string}  error    - Inline error message; shown below and set as a custom validity. Default `""`.
 * @prop {Object}  labels   - Override UI strings. Keys: `required`. Unset keys keep the English default.
 * @attr {string}  name     - Field name for native `<form>` submission.
 *
 * @fires change - Native, bubbling `change` from the inner checkbox (on toggle). Read `.checked` / `event.target.checked`.
 *
 * @method focus - `focus() => void` — focus the inner checkbox.
 *
 * @cssprop [--pd-switch-height] - Track height (defaults to a share of `--control-height-md`).
 * @cssprop [--pd-switch-width]  - Track width (defaults to `calc(--pd-switch-height * 1.8)`).
 *
 * @example
 * const sw = document.createElement("puredashboard-switch");
 * sw.label = "Enable notifications"; sw.checked = true;
 * sw.setAttribute("name", "notify");
 * sw.addEventListener("change", (e) => console.log(e.target.checked));
 * form.append(sw);
 */
class PuredashboardSwitch extends Reactive {
  static formAssociated = true;
  static properties = {
    checked: {}, disabled: {}, required: {}, value: {}, label: {}, error: {}, labels: {},
  };

  constructor() {
    super();
    try { this._internals = this.attachInternals(); } catch { this._internals = null; }
    this._errId = `js-puredashboard-switch__error-${++uid}`;
  }

  // Reflect declarative HTML attributes into reactive properties, so the control
  // can be configured the natural way inside a form — <puredashboard-switch
  // checked required> — not only via JS. Boolean attrs map by presence.
  static observedAttributes = ["checked", "disabled", "required", "value", "label"];
  attributeChangedCallback(name, _old, val) {
    const bool = name === "checked" || name === "disabled" || name === "required";
    this[name] = bool ? val !== null : val;
  }

  // _label(key, …args) → localised string: this.labels override, else the default.
  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  setup() {
    this._default = this.hasAttribute("checked");
    if (this.checked == null) this.checked = this._default;
    // The inner checkbox fires a native `change` that bubbles through the host
    // unchanged — the idiomatic, framework-agnostic API (consumers read `.checked`
    // or `event.target.checked`). We only mirror the checked state into our own
    // property so it, the owning <form>, and validity stay in sync. No re-dispatch —
    // that would double-deliver the event under its native name.
    this.on("change", ".js-puredashboard-switch__input", (e, el) => { this.checked = el.checked; });
  }

  // Form-associated lifecycle.
  formResetCallback() { this.checked = this._default ?? false; }
  formDisabledCallback(disabled) { this.disabled = disabled; }
  get form() { return this._internals ? this._internals.form : null; }
  get validity() { return this._internals ? this._internals.validity : null; }
  checkValidity() { return this._internals ? this._internals.checkValidity() : true; }
  focus() { this.$(".js-puredashboard-switch__input")?.focus(); }

  _input() { return this.$(".js-puredashboard-switch__input"); }

  // Push the current value + validity into the owning <form> after every render.
  updated() {
    if (!this._internals || !this._internals.setFormValue) return;
    this._internals.setFormValue(this.checked ? (this.value ?? "on") : null);
    const input = this._input();
    if (this.error) this._internals.setValidity({ customError: true }, this.error, input || undefined);
    else if (this.required && !this.checked) this._internals.setValidity({ valueMissing: true }, this._label("required"), input || undefined);
    else this._internals.setValidity({});
  }

  render() {
    const bad = !!this.error;
    return html`
      <label class="puredashboard-switch__root">
        <span class="puredashboard-switch__control">
          <input class="puredashboard-switch__input js-puredashboard-switch__input" type="checkbox" role="switch" .checked="${!!this.checked}" ?disabled="${!!this.disabled}" ?required="${!!this.required}" aria-invalid="${bad ? "true" : "false"}" aria-describedby="${this.error ? this._errId : ""}">
          <span class="puredashboard-switch__track"><span class="puredashboard-switch__knob"></span></span>
        </span>
        ${this.label ? html`<span class="puredashboard-switch__label">${this.label}</span>` : ""}
      </label>
      ${this.error ? html`<div class="puredashboard-switch__error" id="${this._errId}" role="alert">${this.error}</div>` : ""}`;
  }
}
PuredashboardSwitch.define("puredashboard-switch");

export { PuredashboardSwitch };
