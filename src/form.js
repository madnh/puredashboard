// <puredashboard-form> — a form ORCHESTRATOR/container (NOT a form-associated input).
// Zero-dep, no build, CSP-safe. Extends plain HTMLElement (NOT Reactive) — a
// Reactive render() would blow away the author's light-DOM children, and this
// component's whole job is to PRESERVE those children while wrapping them.
//
// Why it exists: a form-associated custom element (input, select, checkbox,
// switch, number, slider, radio-group) only associates with a real native
// <form> ancestor — never with a custom element. So this component, on connect,
// creates ONE real <form>, MOVES the author's existing children into it (order
// preserved), and appends the <form> to itself. Every descendant control then
// associates with that <form>. It centralises submit + validation + value
// collection: it intercepts the native "submit", runs constraint validation,
// and re-emits a bubbling "submit" CustomEvent from the host with the collected
// values (or "invalid" when validation fails). Follows the same conventions as
// the input family: fixed strings in a LABELS map + a `labels` override, BEM
// classes namespaced by the tag, script hooks as SEPARATE js-… classes, and
// theming through the shared design tokens (--sp-*, --border, --danger) with a
// --pd-* fallback chain so it works with no theme linked.
//
// It is deliberately NOT form-associated: it is not a value-bearing control, it
// is the container the controls submit through.

// All FIXED user-facing strings live here (English defaults). Override any
// subset via the `labels` property — e.g. form.labels = { submit: "Gửi" }.
// Function-valued keys interpolate. Authors usually supply their own buttons, so
// these are only fallbacks (e.g. an aria-label on the wrapping <form>).
const LABELS = {
  submit: "Submit",
  form: "Form",
};

/**
 * A form ORCHESTRATOR that wraps its light-DOM children in a real native
 * `<form>` so PureDashboard's form-associated controls (input, select, checkbox,
 * switch, number, slider, radio-group) placed inside it associate correctly —
 * form-associated custom elements only associate with a real `<form>` ancestor,
 * never with a custom element. It then centralises submit, validation and value
 * collection: it intercepts the native submit, runs constraint validation, and
 * re-emits a bubbling `submit` CustomEvent from the host with the collected
 * values (or `invalid` when validation fails). It is NOT itself a
 * form-associated control — it is the container the controls submit through.
 *
 * Place your fields and a `<button type="submit">` as ordinary children; they
 * are moved into the internal `<form>` on connect, in order, without being
 * destroyed. Configure via JS properties or declarative attributes.
 *
 * @element puredashboard-form
 *
 * @prop {boolean} noValidate - Skip `checkValidity()` and always submit (like a native `<form novalidate>`). Default `false`.
 * @prop {Object}  labels     - Override UI strings. Keys: `submit`, `form`. Unset keys keep the English default.
 * @prop {Object}  values     - Read-only getter: the current values as a plain object (repeated names become arrays).
 * @attr {boolean} novalidate - Declarative form of `noValidate`.
 *
 * @fires submit  - `CustomEvent` (bubbles, cancelable) on a valid submit. `detail = { values, formData, valid: true }`.
 * @fires invalid - `CustomEvent` (bubbles) when submit is blocked by failing validation. `detail = { valid: false }`.
 * @fires reset   - `CustomEvent` (bubbles) after the internal `<form>` resets.
 *
 * @method submit        - `submit() => void` — request a programmatic submit (runs validation, fires `submit`/`invalid`).
 * @method reset         - `reset() => void` — reset the internal `<form>` (fires `reset`).
 * @method checkValidity - `checkValidity() => boolean` — run constraint validation on all fields.
 *
 * @cssprop [--pd-form-gap] - Vertical gap between fields (defaults to `--sp-4`).
 *
 * @example
 * // <puredashboard-form>
 * //   <puredashboard-input name="email" type="email" required></puredashboard-input>
 * //   <button type="submit">Save</button>
 * // </puredashboard-form>
 * const form = document.querySelector("puredashboard-form");
 * form.addEventListener("submit", (e) => console.log(e.detail.values)); // { email: "…" }
 */
class PuredashboardForm extends HTMLElement {
  static get observedAttributes() { return ["novalidate"]; }

  constructor() {
    super();
    this._wrapped = false;
    this._form = null;
    // A template engine may set `.labels` before upgrade, leaving a plain
    // own-property that shadows nothing important here, but reconcile for parity
    // with the rest of the library.
    this._upgrade("labels");
    this._upgrade("noValidate");
  }

  _upgrade(p) {
    if (Object.prototype.hasOwnProperty.call(this, p)) { const v = this[p]; delete this[p]; this[p] = v; }
  }

  attributeChangedCallback(name, _old, val) {
    if (name === "novalidate") this.noValidate = val !== null;
  }

  // _label(key, …args) → localised string: this.labels override, else the default.
  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  connectedCallback() {
    this._wrap();
  }

  // Create ONE real <form> and MOVE the author's current children into it,
  // preserving order, then append the <form> to the host. Guarded so it runs
  // exactly once even across disconnect/reconnect — moving children again would
  // be a no-op at best and re-wrapping the wrapper at worst.
  _wrap() {
    if (this._wrapped) return;
    this._wrapped = true;

    const form = document.createElement("form");
    form.className = "puredashboard-form__form js-puredashboard-form__form";
    form.setAttribute("novalidate", "");            // WE run validation; suppress the browser's own UI/bubbles
    form.setAttribute("aria-label", this._label("form"));

    // Move existing children (NOT clone) so live nodes, listeners and any
    // already-associated controls are preserved. Re-reading firstChild each loop
    // handles the live NodeList as we append into the form.
    while (this.firstChild) form.appendChild(this.firstChild);
    this.appendChild(form);
    this._form = form;

    form.addEventListener("submit", this._onSubmit);
    form.addEventListener("reset", this._onReset);
  }

  disconnectedCallback() {
    if (this._form) {
      this._form.removeEventListener("submit", this._onSubmit);
      this._form.removeEventListener("reset", this._onReset);
    }
  }

  _onSubmit = (e) => {
    e.preventDefault();                              // never let the browser navigate
    // The native "submit" bubbles form → host; stop it so it doesn't reach the
    // host's listeners as a bare native event. We re-emit our OWN "submit"
    // CustomEvent (with detail) from the host below — that's the public API.
    e.stopPropagation();
    if (!this.noValidate && !this.checkValidity()) {
      this.dispatchEvent(new CustomEvent("invalid", { bubbles: true, detail: { valid: false } }));
      this._focusFirstInvalid();
      return;
    }
    const formData = new FormData(this._form);
    const values = this._collect(formData);
    this.dispatchEvent(new CustomEvent("submit", { bubbles: true, cancelable: true, detail: { values, formData, valid: true } }));
  };

  _onReset = (e) => {
    // Stop the native "reset" bubbling to the host; re-emit our own from the host.
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent("reset", { bubbles: true, detail: {} }));
  };

  // Build a plain object from FormData entries. A name that appears more than
  // once (multi-selects, checkbox groups) collapses into an array in order.
  _collect(formData) {
    // Null-prototype bag: a field named "__proto__"/"constructor" is then a plain
    // own key (no magic setter to corrupt the object, no Object.prototype pollution).
    const values = Object.create(null);
    for (const [key, val] of formData.entries()) {
      if (key in values) {
        if (Array.isArray(values[key])) values[key].push(val);
        else values[key] = [values[key], val];
      } else {
        values[key] = val;
      }
    }
    return values;
  }

  // Focus the first control failing constraint validation, so the user lands on
  // the problem. Falls back gracefully where :invalid isn't queryable (jsdom).
  _focusFirstInvalid() {
    if (!this._form) return;
    let first = null;
    try { first = this._form.querySelector(":invalid"); } catch { /* :invalid unsupported */ }
    if (!first) {
      const controls = this._form.querySelectorAll("input, select, textarea, [name]");
      for (const c of controls) {
        if (typeof c.checkValidity === "function" && !c.checkValidity()) { first = c; break; }
      }
    }
    if (first && typeof first.focus === "function") first.focus();
  }

  // ---- public API ----------------------------------------------------------
  submit() {
    if (!this._form) return;
    // Route through the same code path as a native submit so behaviour is
    // identical. requestSubmit fires a cancelable "submit" event (which our
    // listener handles); fall back to dispatching one where it's unavailable.
    if (typeof this._form.requestSubmit === "function") {
      this._form.requestSubmit();
    } else {
      const ev = new Event("submit", { bubbles: true, cancelable: true });
      this._form.dispatchEvent(ev);
    }
  }

  reset() { if (this._form) this._form.reset(); }

  checkValidity() {
    if (!this._form) return true;
    return typeof this._form.checkValidity === "function" ? this._form.checkValidity() : true;
  }

  get form() { return this._form; }

  get values() { return this._form ? this._collect(new FormData(this._form)) : {}; }
}

customElements.define("puredashboard-form", PuredashboardForm);

export { PuredashboardForm };
