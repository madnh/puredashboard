// <puredashboard-field> — a form field wrapper: a visible label above a control, an optional hint and an optional error below it.
// Zero-dep, no build, CSP-safe. Extends plain HTMLElement (NOT Reactive) — a Reactive render() would blow away the author's control,
// and this component's whole job is to PRESERVE it: the control (a PureDashboard control or a native input/select/textarea) stays the
// author's own child, unmoved and unwrapped; the label, hint and error are added around it as light-DOM siblings.
//
// What it wires, so the author does not have to:
//   - <label for> → the control (an id is generated if the control has none). A PureDashboard control is a custom element, where a click
//     on a <label for> does not move focus to its inner native field, so a click on the label also calls the control's `focus()`.
//   - the label id is added to the `aria-labelledby`, the hint and error ids to the `aria-describedby`, and `aria-invalid="true"` is set
//     while there is an error, all on the control's inner native field (input / select / textarea / radiogroup / combobox): set directly,
//     kept when the control re-renders (also for a control appended after connect), and removed again when the label/hint/error is cleared.
//
// Class naming (BEM, block = the component tag): style classes are namespaced `puredashboard-field__<element>[--<modifier>]`.
// Themed through the shared design tokens (--sp-*, --font-size-*, --text, --muted, --danger) with a --pd-* fallback chain so it looks
// right with NO theme linked.

// All FIXED user-facing strings live here (English defaults). This component renders only author text (label, hint, error), so the
// map is intentionally empty — kept for parity with the rest of the library and so future strings have a home.
const LABELS = {};

let uid = 0;

// The inner native field of a control that carries the accessible name/description: the control itself if it is native,
// else the first native field (or radiogroup / combobox element) inside the custom element.
const NATIVE = "input, select, textarea";
const INNER = `${NATIVE}, [role=radiogroup], [role=combobox]`;

/**
 * A form field wrapper: `label`, then the control the author put inside, then an optional `hint` and `error`. Configure via JS
 * properties or declarative attributes; attribute changes are reflected live. The label, hint and error are plain text (never HTML).
 *
 * @element puredashboard-field
 *
 * @prop {string}  label  - Visible label text, placed above the control and associated with it (`<label for>`). Default `""` (none).
 * @prop {string}  hint   - Help text below the control; referenced by the control's `aria-describedby`. Default `""` (none).
 * @prop {string}  error  - Error text below the control (`role="alert"`); referenced by the control's `aria-describedby`, and the control's inner field is marked `aria-invalid="true"` while it is set. Default `""` (none).
 * @prop {Object}  labels - Override UI strings. This component renders no text of its own, so usually unused.
 * @attr {string}  label  - Declarative form of `label`.
 * @attr {string}  hint   - Declarative form of `hint`.
 * @attr {string}  error  - Declarative form of `error`.
 *
 * @method focus - `focus() => void` — focus the control.
 *
 * @cssprop [--pd-field-gap] - Gap between label, control, hint and error (defaults to `--sp-1`).
 *
 * @example
 * // <puredashboard-field label="Email" hint="We never share it.">
 * //   <puredashboard-input name="email" type="email"></puredashboard-input>
 * // </puredashboard-field>
 * const f = document.createElement("puredashboard-field");
 * f.label = "Email"; f.hint = "We never share it.";
 * f.append(inputEl);
 */
class PuredashboardField extends HTMLElement {
  static get observedAttributes() { return ["label", "hint", "error"]; }

  constructor() {
    super();
    this._labelText = "";
    this._hint = "";
    this._error = "";
    this._uid = ++uid;
    this._mc = null;
    // A template engine may set these properties before upgrade, leaving plain own-properties that shadow the accessors. Reconcile
    // them for parity with the rest of the library.
    for (const p of ["label", "hint", "error", "labels"]) this._upgrade(p);
  }

  _upgrade(p) {
    if (Object.prototype.hasOwnProperty.call(this, p)) { const v = this[p]; delete this[p]; this[p] = v; }
  }

  // _label(key, …args) → localised string: this.labels override, else the default.
  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  attributeChangedCallback(name, _old, val) { this[name] = val; }   // the setters normalise null to "" and re-apply

  get label() { return this._labelText; }
  set label(v) { this._labelText = v == null ? "" : String(v); this._apply(); }
  get hint() { return this._hint; }
  set hint(v) { this._hint = v == null ? "" : String(v); this._apply(); }
  get error() { return this._error; }
  set error(v) { this._error = v == null ? "" : String(v); this._apply(); }

  connectedCallback() {
    this._apply();
    // The control may be appended after connect, and a library control re-renders its inner native field, dropping what we set on it:
    // re-apply after any change inside this element. _apply() is idempotent, so our own writes settle after one pass.
    if (typeof MutationObserver !== "undefined" && !this._mc) {
      this._mc = new MutationObserver(() => this._apply());
      this._mc.observe(this, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-describedby", "aria-labelledby", "aria-invalid"] });
    }
    this.addEventListener("click", this._onClick);
  }

  disconnectedCallback() {
    this._mc?.disconnect();
    this._mc = null;
    this.removeEventListener("click", this._onClick);
  }

  // A click on our label focuses the control (a custom-element host does not forward <label for> focus to its inner field).
  _onClick = (e) => {
    const l = this._lbl;
    if (!l || !e.target || !l.contains(e.target)) return;
    const c = this._control();
    if (c && typeof c.focus === "function" && !c.matches(NATIVE)) c.focus();
  };

  focus() { this._control()?.focus?.(); }

  // The control = the first element child that is not one of our own parts.
  _control() {
    for (const el of this.children) if (!el.classList.contains("js-puredashboard-field__part")) return el;
    return null;
  }

  _part(kind, tag, id) {
    let el = this[`_${kind}El`];
    if (!el) {
      el = document.createElement(tag);
      el.className = `puredashboard-field__part puredashboard-field__${kind} js-puredashboard-field__part`;
      el.id = id;
      this[`_${kind}El`] = el;
    }
    return el;
  }

  get _lbl() { return this._labelEl && this._labelEl.isConnected ? this._labelEl : null; }

  // The single place that writes the DOM: add/update/remove the label, hint and error around the control, put them in order (label,
  // control, hint, error) and re-wire the ids. Idempotent: it only moves a node that is out of place, so it can run after every change.
  // Nothing happens until the element is connected: attributes are set before the author's children are appended.
  _apply() {
    if (!this.isConnected) return;
    this.classList.add("puredashboard-field");
    const c = this._control();
    if (this._labelText) {
      const l = this._part("label", "label", `js-puredashboard-field__label-${this._uid}`);
      if (l.textContent !== this._labelText) l.textContent = this._labelText;
      if (c) { if (!c.id) c.id = `js-puredashboard-field__control-${this._uid}`; if (l.htmlFor !== c.id) l.htmlFor = c.id; }
    } else this._labelEl?.remove();
    if (this._hint) {
      const h = this._part("hint", "div", `js-puredashboard-field__hint-${this._uid}`);
      if (h.textContent !== this._hint) h.textContent = this._hint;
    } else this._hintEl?.remove();
    if (this._error) {
      const e = this._part("error", "div", `js-puredashboard-field__error-${this._uid}`);
      if (e.getAttribute("role") !== "alert") e.setAttribute("role", "alert");
      if (e.textContent !== this._error) e.textContent = this._error;
    } else this._errorEl?.remove();
    const order = [this._labelText ? this._labelEl : null, c, this._hint ? this._hintEl : null, this._error ? this._errorEl : null].filter(Boolean);
    order.forEach((el, i) => { if (this.children[i] !== el) this.insertBefore(el, this.children[i] ?? null); });
    this._describe();
  }

  // Wire the label, hint and error onto the control's inner native field (set directly: a control does not re-render when only our
  // label/hint/error change, and ElementInternals.labels is read by the control only when it renders): the label id in aria-labelledby,
  // the hint/error ids in aria-describedby, and aria-invalid while there is an error. Our ids are dropped again when cleared.
  _describe() {
    const c = this._control();
    if (!c) return;
    const t = c.matches(INNER) ? c : c.querySelector(INNER);
    if (!t) return;
    const id = (k) => `js-puredashboard-field__${k}-${this._uid}`;
    const ids = (attr, mine, want) => {
      const rest = (t.getAttribute(attr) ?? "").split(/\s+/).filter((x) => x && !mine.includes(x));
      const next = [...rest, ...want].join(" ");
      if (next === "") { if (t.hasAttribute(attr)) t.removeAttribute(attr); }
      else if (t.getAttribute(attr) !== next) t.setAttribute(attr, next);
    };
    ids("aria-labelledby", [id("label")], this._labelText ? [id("label")] : []);
    ids("aria-describedby", [id("hint"), id("error")], [this._hint ? id("hint") : "", this._error ? id("error") : ""].filter(Boolean));
    if (this._error) {
      this._invalidSet = true;
      if (t.getAttribute("aria-invalid") !== "true") t.setAttribute("aria-invalid", "true");
    } else if (this._invalidSet) {
      // Back to what the control says itself (a library control with its own error/invalid stays invalid).
      this._invalidSet = false;
      t.setAttribute("aria-invalid", c.error || c.invalid ? "true" : "false");
    }
  }
}

customElements.define("puredashboard-field", PuredashboardField);

export { PuredashboardField };
