// <puredashboard-color> — a form-associated colour picker.
// Zero-dep, no build, CSP-safe. Built on the Reactive base.
//
// It WRAPS a native <input type="color"> — so the OS colour picker, keyboard
// interaction and accessibility come for free — and presents it as a themed
// swatch, optionally with the hex code shown alongside (mono, read-only text).
// The inner input stays a real <input type="color">: its native `input`/`change`
// events bubble through the host unchanged (no re-dispatch), and the host mirrors
// the value into its own state + the owning <form> via ElementInternals so it
// submits under its `name` and participates in constraint validation like a
// built-in field. Follows the same pattern as input.js — see that file and
// docs/DEVELOPMENT.md → "Definition of Done".
import { Reactive, html } from "./reactive.js";

// All user-facing strings live here (English defaults). Override any subset via
// the `labels` property to localise — e.g. col.labels = { choose: "Chọn màu" }.
// Function-valued keys interpolate.
const LABELS = {
  choose: "Choose a colour",
};

// Unique ids for <label>s we have to reference from the inner control's aria-labelledby.
let labelId = 0;

/**
 * A form-associated colour picker. Wraps a native `<input type="color">` (so the
 * OS colour picker, keyboard and a11y are inherited) and participates in a
 * surrounding `<form>` natively via `ElementInternals` — it submits under its
 * `name` and validates like a built-in field. Presented as a themed swatch plus
 * an optional read-only hex label (mono). Configure via JS properties or the
 * reflected attributes.
 *
 * @element puredashboard-color
 *
 * @prop {string}  value     - Current colour as a `#rrggbb` hex string (get/set). Default `"#000000"`.
 * @prop {boolean} disabled  - Disable the control. Default `false`.
 * @prop {boolean} showValue - Show the hex code next to the swatch (read-only, mono). Default `false`.
 * @prop {string}  size      - `"sm"` | `"md"` | `"lg"`. Default `"md"`.
 * @prop {Object}  labels    - Override UI strings. Keys: `choose`. Unset keys keep the English default.
 * @attr {string}  name        - Field name for native `<form>` submission.
 * @attr {boolean} show-value  - Attribute form of `showValue`.
 * @attr {string}  aria-label - Accessible name for the control. The host has no role of its own, so it is MIRRORED onto the inner native control (as is `aria-labelledby`, and any `<label>` associated with the host) — that mirrored value is what a screen reader announces.
 *
 * @fires input  - Native, bubbling `input` from the inner field (live drag). Read `.value` / `event.target.value`.
 * @fires change - Native, bubbling `change` from the inner field (commit). Read `.value` / `event.target.value`.
 *
 * @method focus - `focus() => void` — focus the inner colour input.
 *
 * @cssprop [--pd-color-size] - Swatch edge length (defaults to `--control-height-md`).
 *
 * @example
 * const col = document.createElement("puredashboard-color");
 * col.value = "#4f9cf9"; col.showValue = true;
 * col.setAttribute("name", "brand");
 * col.addEventListener("change", (e) => console.log(e.target.value));
 * form.append(col);
 */
class PuredashboardColor extends Reactive {
  static formAssociated = true;
  static properties = {
    value: {}, disabled: {}, showValue: {}, size: {}, labels: {},
  };

  constructor() {
    super();
    try { this._internals = this.attachInternals(); } catch { this._internals = null; }
  }

  // Reflect declarative HTML attributes into reactive properties, so the control
  // can be configured the natural way inside a form — <puredashboard-color
  // value="#4f9cf9" show-value> — not only via JS. Boolean attrs map by presence.
  static observedAttributes = ["value", "disabled", "name", "show-value", "aria-label", "aria-labelledby"];
  attributeChangedCallback(name, _old, val) {
    if (name.startsWith("aria-")) { this.requestUpdate(); return; }   // mirrored onto the inner control in render()
    if (name === "disabled") this.disabled = val !== null;
    else if (name === "show-value") this.showValue = val !== null;
    else if (name === "value") this.value = val;
    // `name` is a plain attribute read by ElementInternals — nothing to reflect.
  }

  // _label(key, …args) → localised string: this.labels override, else the default.
  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  setup() {
    this._default = this.getAttribute("value") ?? "#000000";
    if (this.value == null) this.value = this._default;
    // The inner <input type=color> fires native `input`/`change` that bubble
    // through the host unchanged — the idiomatic, framework-agnostic API
    // (consumers read `.value` or `event.target.value`). We only mirror the value
    // into our state so the property, the owning <form>, and the hex label stay
    // in sync. No re-dispatch — that would double-deliver the native event.
    const sync = (e, el) => { this.value = el.value; };
    this.on("input", ".js-puredashboard-color__input", sync);
    this.on("change", ".js-puredashboard-color__input", sync);
  }

  // Form-associated lifecycle.
  formResetCallback() { this.value = this._default ?? "#000000"; }
  formDisabledCallback(disabled) { this.disabled = disabled; }
  get form() { return this._internals ? this._internals.form : null; }
  get validity() { return this._internals ? this._internals.validity : null; }
  checkValidity() { return this._internals ? this._internals.checkValidity() : true; }
  focus() { this.$(".js-puredashboard-color__input")?.focus(); }

  _input() { return this.$(".js-puredashboard-color__input"); }

  // Push the current value + validity into the owning <form> after every render.
  updated() {
    if (!this._internals || !this._internals.setFormValue) return;
    this._internals.setFormValue(this.value ?? "");
    const field = this._input();
    if (field && field.validity) this._internals.setValidity(field.validity, field.validationMessage, field);
    else this._internals.setValidity({});
  }

  // Accessible name: the author names this control by putting aria-label /
  // aria-labelledby on the HOST, but the host carries no role — so the name must be
  // mirrored onto the inner native control, which is what assistive tech announces.
  // (Same rule as button.js; unset → empty, which the browser ignores, so a wrapping
  // <label> or the visible label keeps naming the control.)
  _ariaName() { return this.getAttribute("aria-label") ?? this._label("choose"); }
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
    const val = this.value ?? "#000000";
    const sizeCls = this.size === "sm" ? " puredashboard-color__swatch--sm" : this.size === "lg" ? " puredashboard-color__swatch--lg" : "";
    return html`
      <input class="puredashboard-color__swatch js-puredashboard-color__input${sizeCls}" type="color" .value="${val}" ?disabled="${!!this.disabled}" aria-label="${this._ariaName()}" aria-labelledby="${this._ariaNamedBy()}">
      ${this.showValue ? html`<span class="puredashboard-color__value">${val}</span>` : ""}`;
  }
}
PuredashboardColor.define("puredashboard-color");

export { PuredashboardColor };
