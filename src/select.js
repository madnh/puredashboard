// <puredashboard-select> — a form-associated single-choice select.
// Zero-dep, no build, CSP-safe. Built on the Reactive base.
//
// This is input.js specialised to a fixed list of choices: it WRAPS a native
// <select> so correct keyboard navigation, typeahead, screen-reader listbox
// semantics, native mobile pickers and constraint validation are inherited for
// free — the lowest-risk, most accessible choice for a security-critical admin.
// (A searchable/filterable combobox is a SEPARATE future component; this one is
// deliberately just a real <select>.) It participates in a surrounding <form>
// natively via ElementInternals — it submits under its `name` and validates like
// a built-in field. The inner <select> intentionally has NO `name`, so only the
// host's ElementInternals value is submitted (no duplicate field).
//
// Class naming (BEM, block = the component tag): every style class is namespaced
// `puredashboard-select__<element>[--<modifier>]`; script hooks are SEPARATE
// `js-…` classes (never restyle or remove those). Themed through the shared design
// tokens (--control-height-*, --control-pad-x, --focus-ring, --radius, --border,
// --panel, --danger-bg, …) via a --pd-* fallback chain so it looks right with NO
// theme linked. The dropdown chevron is an inline, self-contained SVG overlaid on
// the control, decorative (aria-hidden) and non-interactive (pointer-events:none)
// so it never intercepts a click on the native <select>.
// See docs/DEVELOPMENT.md → "Definition of Done".
import { Reactive, html, repeat, labelIdFor } from "./reactive.js";

// All user-facing strings live here (English defaults). Override any subset via the
// `labels` property to localise — e.g. sel.labels = { required: "Bắt buộc" }.
// Function-valued keys interpolate. NB: option labels and the placeholder text are
// CONTENT (from `options` / the `placeholder` property), not fixed UI strings.
const LABELS = {
  required: "This field is required.",
};

let uid = 0;

/**
 * A form-associated single-choice select. Wraps a native `<select>` (so keyboard
 * navigation, typeahead, screen-reader listbox semantics, native mobile pickers
 * and constraint validation are inherited) and participates in a surrounding
 * `<form>` natively via `ElementInternals` — it submits under its `name` and
 * validates like a built-in field. Configure via JS properties.
 *
 * The inner native `<select>` deliberately carries no `name`; only the host's
 * `ElementInternals` value is submitted, so there is no duplicate form field.
 *
 * @element puredashboard-select
 *
 * @prop {Array<{value:string,label:string,disabled?:boolean}>|string[]} options - The choices. A plain `string[]` is accepted too (then `value === label`). Default `[]`.
 * @prop {string}  value       - Current selected value (get/set), mirroring the inner `<select>`. Default `""`.
 * @prop {string}  placeholder - Text for a leading disabled/empty option, shown when no value is selected. Default `""` (no placeholder option).
 * @prop {boolean} disabled    - Disable the control. Default `false`.
 * @prop {boolean} required    - Mark required (empty → `valueMissing`). Default `false`.
 * @prop {string}  size        - `"sm"` | `"md"` | `"lg"`. Default `"md"`.
 * @prop {boolean} invalid     - Force the invalid visual state. Default `false`.
 * @prop {string}  error       - Inline error message; shown below and set as a custom validity. Default `""`.
 * @prop {Object}  labels      - Override UI strings. Keys: `required`. Unset keys keep the English default.
 * @attr {string}  name        - Field name for native `<form>` submission (on the host, not the inner select).
 * @attr {string}  aria-label - Accessible name for the control. The host has no role of its own, so it is MIRRORED onto the inner native control (as is `aria-labelledby`, and any `<label>` associated with the host) — that mirrored value is what a screen reader announces.
 *
 * @fires change - Native, bubbling `change` from the inner `<select>`. Read `.value` / `event.target.value`.
 *
 * @method focus - `focus() => void` — focus the inner select.
 *
 * @cssprop [--pd-select-height] - Control height (defaults to `--control-height-md`).
 * @cssprop [--pd-select-pad-x]  - Horizontal padding (defaults to `--control-pad-x`).
 *
 * @example
 * const sel = document.createElement("puredashboard-select");
 * sel.options = [{ value: "us", label: "United States" }, { value: "vn", label: "Vietnam" }];
 * sel.placeholder = "Choose a country"; sel.required = true;
 * sel.setAttribute("name", "country");
 * sel.addEventListener("change", (e) => console.log(e.target.value));
 * form.append(sel);
 */
class PuredashboardSelect extends Reactive {
  static formAssociated = true;
  static properties = {
    options: {}, value: {}, placeholder: {}, disabled: {}, required: {},
    size: {}, invalid: {}, error: {}, labels: {},
  };

  constructor() {
    super();
    try { this._internals = this.attachInternals(); } catch { this._internals = null; }
    this._errId = `js-puredashboard-select__error-${++uid}`;
  }

  // Reflect declarative HTML attributes into reactive properties, so the control
  // can be configured the natural way inside a form — <puredashboard-select
  // required disabled size="sm"> — not only via JS. Boolean attrs map by presence.
  // (`options` are data, set via the property, not an attribute.)
  static observedAttributes = ["value", "size", "disabled", "required", "name", "aria-label", "aria-labelledby"];
  attributeChangedCallback(name, _old, val) {
    if (name.startsWith("aria-")) { this.requestUpdate(); return; }   // mirrored onto the inner control in render()
    if (name === "name") return; // read live via getAttribute in updated(); not reactive state
    const bool = name === "disabled" || name === "required";
    this[name] = bool ? val !== null : val;
  }

  // _label(key, …args) → localised string: this.labels override, else the default.
  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  // Normalise `options` into {value,label,disabled} objects, accepting a plain
  // string[] where value === label. Everything else coerces to a string.
  _options() {
    const list = Array.isArray(this.options) ? this.options : [];
    return list.map((o) => {
      if (o != null && typeof o === "object") {
        const value = String(o.value ?? "");
        return { value, label: String(o.label ?? value), disabled: !!o.disabled };
      }
      const s = String(o ?? "");
      return { value: s, label: s, disabled: false };
    });
  }

  setup() {
    this._default = this.getAttribute("value") ?? "";
    if (this.value == null) this.value = this._default;
    if (this.options == null) this.options = [];
    // The inner <select> fires a native `change` that bubbles through the host
    // unchanged — the idiomatic, framework-agnostic API (consumers read `.value`
    // or `event.target.value`). We only mirror the value into our state so the
    // property, the owning <form>, and validity stay in sync. No re-dispatch —
    // that would double-deliver the event under its native name.
    this.on("change", ".js-puredashboard-select__field", (e, el) => { this.value = el.value; });
  }

  // Form-associated lifecycle.
  formResetCallback() { this.value = this._default ?? ""; }
  formDisabledCallback(disabled) { this.disabled = disabled; }
  get form() { return this._internals ? this._internals.form : null; }
  get validity() { return this._internals ? this._internals.validity : null; }
  checkValidity() { return this._internals ? this._internals.checkValidity() : true; }
  focus() { this.$(".js-puredashboard-select__field")?.focus(); }

  _field() { return this.$(".js-puredashboard-select__field"); }

  // Push the current value + validity into the owning <form> after every render.
  // required && empty → valueMissing; an explicit `error` → customError; otherwise
  // mirror the native <select>'s own validity. Value is set to null when empty so a
  // required, unselected control reads as truly missing to the form.
  updated() {
    // Keep the inner select's selection pinned to our value even when the value
    // matches an option that renders after the property is set.
    const field = this._field();
    if (field && field.value !== (this.value ?? "")) field.value = this.value ?? "";
    if (!this._internals || !this._internals.setFormValue) return;
    this._internals.setFormValue(this.value ?? null);
    if (this.error) this._internals.setValidity({ customError: true }, this.error, field || undefined);
    else if (this.required && !this.value) this._internals.setValidity({ valueMissing: true }, this._label("required"), field || undefined);
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
    const sizeCls = this.size === "sm" ? " puredashboard-select__field--sm" : this.size === "lg" ? " puredashboard-select__field--lg" : "";
    const opts = this._options();
    return html`
      <div class="puredashboard-select__control">
        <select class="puredashboard-select__field js-puredashboard-select__field${sizeCls}" aria-label="${this._ariaName()}" aria-labelledby="${this._ariaNamedBy()}" .value="${this.value ?? ""}" ?disabled="${!!this.disabled}" ?required="${!!this.required}" aria-invalid="${invalid ? "true" : "false"}" aria-describedby="${this.error ? this._errId : ""}">
          ${this.placeholder ? html`<option class="puredashboard-select__option" value="" disabled ?selected="${!this.value}">${this.placeholder}</option>` : ""}
          ${repeat(opts, (o) => o.value, (o) => html`<option class="puredashboard-select__option" value="${o.value}" ?disabled="${o.disabled}">${o.label}</option>`)}
        </select>
        <svg class="puredashboard-select__chevron" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
      </div>
      ${this.error ? html`<div class="puredashboard-select__error" id="${this._errId}" role="alert">${this.error}</div>` : ""}`;
  }
}
PuredashboardSelect.define("puredashboard-select");

export { PuredashboardSelect };
