// <puredashboard-radio-group> — a form-associated single-select radio group.
// Zero-dep, no build, CSP-safe. Built on the Reactive base.
//
// Follows the same pattern as the canonical <puredashboard-input> (input.js) and
// its sibling <puredashboard-checkbox> (checkbox.js): form-associated via
// ElementInternals (native <form> submit + constraint validation), state in
// `static properties`, fixed strings in a `LABELS` map, BEM classes namespaced by
// the tag, script hooks as SEPARATE `js-…` classes / `data-*` attrs, and theming
// through the shared design tokens (--accent, --border, --focus-ring, --radius-full,
// --duration-*, --disabled-opacity, …) with a --pd-* fallback chain so it works
// with no theme linked. See docs/DEVELOPMENT.md → "Definition of Done".
//
// Unlike the input/checkbox controls (which WRAP a native element and let native
// `change`/`input` bubble through), a radio group has no single native equivalent:
// native name-grouped <input type="radio"> would double-submit inside a
// form-associated element. So this component OWNS its selection and follows the
// WAI-ARIA APG "Radio Group" pattern by hand — role=radiogroup + role=radio,
// aria-checked, roving tabindex, and the arrow/Home/End keyboard map — exposing the
// value ONLY through ElementInternals and emitting a semantic bubbling `change`
// CustomEvent (detail.value) when the selection changes.
import { Reactive, html, repeat } from "./reactive.js";

// All FIXED user-facing strings live here (English defaults). Override any subset
// via the `labels` property to localise — e.g. rg.labels = { required: "Bắt buộc" }.
// Function-valued keys interpolate. NB: each option's visible label is author
// CONTENT (it comes from the `options` data), NOT a fixed string, so it is never a
// LABELS key.
const LABELS = {
  required: "This field is required.",
};

let uid = 0;

/**
 * A form-associated single-select radio group. Renders a `role="radiogroup"`
 * container holding one `role="radio"` element per option (NOT native
 * name-grouped `<input type="radio">`, which would double-submit inside a
 * form-associated element) and participates in a surrounding `<form>` natively via
 * `ElementInternals` — it submits the selected `value` under its `name` and
 * validates like a built-in field. Follows the WAI-ARIA APG "Radio Group" pattern:
 * roving tabindex (exactly one option tabbable) and the arrow/Home/End keyboard
 * map, skipping disabled options and wrapping at the ends. Configure via JS
 * properties or declarative attributes.
 *
 * @element puredashboard-radio-group
 *
 * @prop {Array<{value:string,label:string|Node,disabled?:boolean}>} options - The options to render. Each `label` accepts a string (auto-escaped) OR a DOM node / nested `html` template / array — pass a node or template to embed a custom element (you build it, you own its safety; plain strings stay escaped). Default `[]`.
 * @prop {string}  value    - Value of the selected option (get/set). Default `""` (none selected).
 * @prop {boolean} disabled - Disable the whole group. Default `false`.
 * @prop {boolean} required - A selection is required (none → `valueMissing`). Default `false`.
 * @prop {string}  error    - Inline error message; shown below and set as a custom validity. Default `""`.
 * @prop {Object}  labels   - Override UI strings. Keys: `required`. Unset keys keep the English default.
 * @attr {string}  name     - Field name for native `<form>` submission.
 * @attr {string}  aria-label      - Accessible name for the group (mirrored to the radiogroup).
 * @attr {string}  aria-labelledby - IDs labelling the group (mirrored to the radiogroup).
 *
 * @fires change - Bubbling `CustomEvent` fired when the selection changes. `detail.value` is the newly selected value.
 *
 * @method focus - `focus() => void` — focus the current roving-tabindex option.
 *
 * @cssprop [--pd-radio-group-gap]  - Gap between options (defaults to `--sp-2`).
 * @cssprop [--pd-radio-size]       - Radio dot size (defaults to a value derived from `--control-height-md`).
 *
 * @example
 * const rg = document.createElement("puredashboard-radio-group");
 * rg.options = [{ value: "s", label: "Small" }, { value: "m", label: "Medium" }];
 * rg.required = true;
 * rg.setAttribute("name", "size");
 * rg.setAttribute("aria-label", "Size");
 * rg.addEventListener("change", (e) => console.log(e.detail.value));
 * form.append(rg);
 */
class PuredashboardRadioGroup extends Reactive {
  static formAssociated = true;
  static properties = {
    options: {}, value: {}, disabled: {}, required: {}, error: {}, labels: {},
  };

  constructor() {
    super();
    try { this._internals = this.attachInternals(); } catch { this._internals = null; }
    this._errId = `js-puredashboard-radio-group__error-${++uid}`;
  }

  // Reflect declarative HTML attributes into reactive properties, so the control
  // can be configured the natural way inside a form — <puredashboard-radio-group
  // required name="size"> — not only via JS. Boolean attrs map by presence.
  static observedAttributes = ["value", "name", "disabled", "required"];
  attributeChangedCallback(name, _old, val) {
    if (name === "name") { this.requestUpdate(); return; }   // used only for form submission
    const bool = name === "disabled" || name === "required";
    this[name] = bool ? val !== null : val;
  }

  // _label(key, …args) → localised string: this.labels override, else the default.
  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  setup() {
    this._default = this.getAttribute("value") ?? "";
    if (this.value == null) this.value = this._default;
    if (this.options == null) this.options = [];
  }

  // Form-associated lifecycle.
  formResetCallback() { this.value = this._default ?? ""; }
  formDisabledCallback(disabled) { this.disabled = disabled; }
  get form() { return this._internals ? this._internals.form : null; }
  get validity() { return this._internals ? this._internals.validity : null; }
  checkValidity() { return this._internals ? this._internals.checkValidity() : true; }
  focus() { (this.$(`.js-puredashboard-radio-group__option[tabindex="0"]`) || this.$(`.js-puredashboard-radio-group__option`))?.focus(); }

  // The list of options, always an array.
  _opts() { return Array.isArray(this.options) ? this.options : []; }
  // Indices of enabled options (group not disabled AND option not disabled).
  _enabled() { const o = this._opts(); const out = []; for (let i = 0; i < o.length; i++) if (!this.disabled && !o[i].disabled) out.push(i); return out; }

  // Select the option at index i (if enabled), move focus to it, and emit `change`
  // when the value actually changes. Central to both click and keyboard handling.
  _select(i) {
    const o = this._opts()[i];
    if (!o || o.disabled || this.disabled) return;
    const changed = this.value !== o.value;
    this.value = o.value;
    // Re-render happens on the microtask; focus the option once it exists.
    queueMicrotask(() => this.$(`[data-idx="${i}"]`)?.focus());
    if (changed) this.emit("change", { value: o.value });
  }

  // Keyboard: implements the WAI-ARIA APG Radio Group map. Down/Right → next
  // enabled option (wraps) + select; Up/Left → previous (wraps) + select; Home →
  // first enabled; End → last enabled; Space → select the focused option. Moving
  // the selection moves focus (handled by _select). Disabled options are skipped.
  _onKeydown(e) {
    if (this.disabled) return;
    const enabled = this._enabled();
    if (!enabled.length) return;
    const cur = Number(e.currentTarget.dataset.idx);
    let target = null;
    switch (e.key) {
      case "ArrowDown": case "ArrowRight": {
        const at = enabled.indexOf(cur);
        target = enabled[(at + 1) % enabled.length]; break;
      }
      case "ArrowUp": case "ArrowLeft": {
        const at = enabled.indexOf(cur);
        target = enabled[(at - 1 + enabled.length) % enabled.length]; break;
      }
      case "Home": target = enabled[0]; break;
      case "End": target = enabled[enabled.length - 1]; break;
      case " ": case "Spacebar": target = cur; break;
      default: return;
    }
    e.preventDefault();
    this._select(target);
  }

  // Push the current value + validity into the owning <form> after every render.
  updated() {
    if (!this._internals || !this._internals.setFormValue) return;
    this._internals.setFormValue(this.value ?? null);
    if (this.error) this._internals.setValidity({ customError: true }, this.error, this);
    else if (this.required && !this.value) this._internals.setValidity({ valueMissing: true }, this._label("required"), this);
    else this._internals.setValidity({});
  }

  // The roving-tabindex owner: the selected option, or (none selected) the first
  // enabled option, or (all disabled) the first option — exactly one is tabbable.
  _tabIndexOwner() {
    const o = this._opts();
    const sel = o.findIndex((x) => x.value === this.value);
    if (sel >= 0) return sel;
    const enabled = this._enabled();
    return enabled.length ? enabled[0] : 0;
  }

  render() {
    const invalid = !!this.error;
    const opts = this._opts();
    const owner = this._tabIndexOwner();
    const label = this.getAttribute("aria-label");
    const labelledby = this.getAttribute("aria-labelledby");
    return html`
      <div class="puredashboard-radio-group__group" role="radiogroup" aria-label="${label ?? ""}" aria-labelledby="${labelledby ?? ""}" aria-invalid="${invalid ? "true" : "false"}" aria-describedby="${this.error ? this._errId : ""}">
        ${repeat(opts, (o) => o.value, (o, i) => {
          const checked = o.value === this.value;
          const optDisabled = !!(this.disabled || o.disabled);
          return html`<div class="puredashboard-radio-group__option js-puredashboard-radio-group__option${checked ? " puredashboard-radio-group__option--checked" : ""}${optDisabled ? " puredashboard-radio-group__option--disabled" : ""}" role="radio" data-idx="${i}" aria-checked="${checked ? "true" : "false"}" aria-disabled="${optDisabled ? "true" : "false"}" tabindex="${i === owner && !optDisabled ? "0" : "-1"}" @click="${() => this._select(i)}" @keydown="${(e) => this._onKeydown(e)}"><span class="puredashboard-radio-group__dot"></span><span class="puredashboard-radio-group__text">${o.label}</span></div>`;
        })}
      </div>
      ${this.error ? html`<div class="puredashboard-radio-group__error" id="${this._errId}" role="alert">${this.error}</div>` : ""}`;
  }
}
PuredashboardRadioGroup.define("puredashboard-radio-group");

export { PuredashboardRadioGroup };
