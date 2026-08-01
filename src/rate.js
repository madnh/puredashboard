// <puredashboard-rate> — a form-associated star rating control.
// Zero-dep, no build, CSP-safe. Built on the Reactive base.
//
// Mirrors input.js / slider.js (the form-associated control family): state in
// `static properties`, all user-facing words in a LABELS map (overridable via one
// `labels` property), BEM classes namespaced by the tag, script hooks as SEPARATE
// `js-…` classes / data-* attributes, and theming through the shared design tokens
// (--amber for the filled star, --accent, --border/--muted, --focus-ring,
// --duration-fast, --disabled-opacity) via a --pd-* fallback chain so it works with
// NO theme linked. It participates in a surrounding <form> natively via
// ElementInternals — it submits under its `name` and validates like a built-in field.
//
// ── Accessibility: ONE role="slider" (a single tab stop) ─────────────────────
// Unlike a naive one-button-per-star widget, the WHOLE control is a single
// focusable role="slider" element. That is the ARIA-approved pattern for a rating:
// it exposes aria-valuemin/max/now + a localisable aria-valuetext ("3 of 5 stars"),
// and the arrow / Home / End keyboard drives the value — so a screen-reader user
// tabs once, hears the current rating, and adjusts it like a range. The stars
// themselves are decorative (aria-hidden) glyphs; per-star titles are advisory only.
//
// The star glyph is TRUSTED inline SVG built via html.js `raw()` — never a route for
// untrusted data. Half stars are painted by overlaying a width-clipped filled glyph
// on top of the empty one, so a fractional value (e.g. 3.5) renders a half star with
// no extra DOM churn.
import { Reactive, html } from "./reactive.js";
import { raw } from "./html.js";

// All user-facing strings live here (English defaults). Override any subset via the
// `labels` property to localise — e.g. r.labels = { ariaLabel: "Đánh giá" }.
// Function-valued keys interpolate.
const LABELS = {
  // Accessible name for the whole slider group.
  ariaLabel: "Rating",
  // aria-valuetext read-out; (value, count) → e.g. "3 of 5 stars".
  valueText: (value, count) => `${value} of ${count} stars`,
  // Advisory per-star title (1-based index) — decorative, not the a11y contract.
  star: (n) => `${n} star${n === 1 ? "" : "s"}`,
};

// Trusted inline SVG (html.js raw()) — a single filled star path, sized in em so the
// component needs no shared icon module. Never a sink for untrusted input.
const starGlyph = raw(
  '<svg class="puredashboard-rate__glyph" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" style="display:block;overflow:visible"><path d="m12 2 2.9 6.26 6.85.72-5.12 4.62 1.46 6.72L12 17.27 5.91 20.34l1.46-6.72L2.25 8.98l6.85-.72z"/></svg>',
);

/**
 * A form-associated star rating control. The WHOLE widget is one focusable
 * `role="slider"` (a single tab stop, NOT one tab stop per star): it exposes
 * `aria-valuemin`/`aria-valuemax`/`aria-valuenow` + a localisable `aria-valuetext`,
 * and the arrow / Home / End keyboard adjusts the value like a range. It participates
 * in a surrounding `<form>` natively via `ElementInternals` — it submits under its
 * `name` and validates like a built-in field. Configure via JS properties or attributes.
 *
 * @element puredashboard-rate
 *
 * @prop {number}  value     - Current rating (get/set). Default `0`.
 * @prop {number}  count     - Number of stars. Default `5`.
 * @prop {boolean} allowHalf - Allow half-star (0.5) increments. Default `false`.
 * @prop {boolean} allowClear- Clicking the current value again clears to `0`. Default `true`.
 * @prop {boolean} disabled  - Disable the control. Default `false`.
 * @prop {boolean} required  - Mark required (`value` of 0 → `valueMissing`). Default `false`.
 * @prop {boolean} readonly  - Display-only: keyboard / pointer input is ignored. Default `false`.
 * @prop {Object}  labels    - Override UI strings. Keys: `ariaLabel`, `valueText`, `star`. Unset keys keep the English default.
 * @attr {string}  name      - Field name for native `<form>` submission.
 * @attr {string}  aria-label - Accessible name, applied to the element that carries the component's role (the host has no role of its own). Overrides the built-in `LABELS` name.
 *
 * @fires change - Bubbling `CustomEvent` with `detail: { value }` whenever the rating changes.
 *
 * @method focus - `focus() => void` — focus the slider.
 *
 * @cssprop [--pd-rate-size] - Star glyph size (defaults to `1.5rem`).
 * @cssprop [--pd-rate-gap]  - Gap between stars (defaults to `--sp-1`).
 *
 * @example
 * const r = document.createElement("puredashboard-rate");
 * r.count = 5; r.allowHalf = true; r.value = 3.5;
 * r.setAttribute("name", "rating");
 * r.addEventListener("change", (e) => console.log(e.detail.value));
 * form.append(r);
 */
class PuredashboardRate extends Reactive {
  static formAssociated = true;
  static properties = {
    value: {}, count: {}, allowHalf: {}, allowClear: {},
    disabled: {}, required: {}, readonly: {}, labels: {},
  };

  constructor() {
    super();
    try { this._internals = this.attachInternals(); } catch { this._internals = null; }
    // Transient hover preview (visual only — never touches value / aria).
    this._hover = 0;
  }

  // Reflect declarative HTML attributes into reactive properties, so the control can
  // be configured the natural way inside a form — <puredashboard-rate count="10"
  // value="3" allow-half required> — not only via JS. Boolean attrs map by presence;
  // numeric attrs (value/count) coerce to Number.
  static observedAttributes = ["value", "count", "allow-half", "allow-clear", "disabled", "required", "readonly", "name"];
  attributeChangedCallback(name, _old, val) {
    if (name === "name") return; // native form field name; read live via getAttribute
    if (name === "allow-half") { this.allowHalf = val !== null; return; }
    if (name === "allow-clear") { this.allowClear = val !== null; return; }
    const bool = name === "disabled" || name === "required" || name === "readonly";
    const num = name === "value" || name === "count";
    this[name] = bool ? val !== null : num ? (val == null ? val : Number(val)) : val;
  }

  // _label(key, …args) → localised string: this.labels override, else the default.
  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  setup() {
    if (this.count == null) this.count = 5;
    if (this.allowClear == null) this.allowClear = true;
    this._default = this.hasAttribute("value") ? Number(this.getAttribute("value")) : 0;
    if (this.value == null) this.value = this._default;
  }

  // Form-associated lifecycle.
  formResetCallback() { this.value = this._default ?? 0; this._hover = 0; }
  formDisabledCallback(disabled) { this.disabled = disabled; }
  get form() { return this._internals ? this._internals.form : null; }
  get validity() { return this._internals ? this._internals.validity : null; }
  checkValidity() { return this._internals ? this._internals.checkValidity() : true; }
  focus() { this.$(".js-puredashboard-rate__slider")?.focus(); }

  // The step between adjacent settable values.
  _step() { return this.allowHalf ? 0.5 : 1; }

  // Clamp v into [0, count] and snap to the current step.
  _clamp(v) {
    const count = Number(this.count) || 5;
    const step = this._step();
    let n = Math.round(Number(v) / step) * step;
    if (!Number.isFinite(n)) n = 0;
    return Math.max(0, Math.min(count, n));
  }

  // Commit a new value (clamped + snapped) and emit a bubbling `change` with detail
  // { value } — but only when it actually changed. No-op while disabled/readonly.
  _set(v) {
    if (this.disabled || this.readonly) return;
    const next = this._clamp(v);
    if (next === Number(this.value)) return;
    this.value = next;
    this.emit("change", { value: next });
  }

  // Push the current value + validity into the owning <form> after every render.
  updated() {
    if (!this._internals || !this._internals.setFormValue) return;
    this._internals.setFormValue(String(this.value ?? 0));
    // required → an empty rating (0) is a "value missing" like a native field.
    if (this.required && !(Number(this.value) > 0)) {
      this._internals.setValidity({ valueMissing: true }, this._label("ariaLabel"), this.$(".js-puredashboard-rate__slider") || undefined);
    } else {
      this._internals.setValidity({});
    }
  }

  // ── Keyboard: the slider role's contract ───────────────────────────────────
  // ArrowRight/Up increment, ArrowLeft/Down decrement (by step — 0.5 when allowHalf),
  // Home = 0, End = count. Ignored while disabled / readonly.
  _onKey(e) {
    if (this.disabled || this.readonly) return;
    const step = this._step();
    const count = Number(this.count) || 5;
    const cur = Number(this.value) || 0;
    let next;
    switch (e.key) {
      case "ArrowRight": case "ArrowUp":   next = cur + step; break;
      case "ArrowLeft":  case "ArrowDown": next = cur - step; break;
      case "Home": next = 0; break;
      case "End":  next = count; break;
      default: return;
    }
    e.preventDefault();
    this._set(next);
  }

  // ── Pointer: click a star to set that value ────────────────────────────────
  // Clicking star N (1-based) sets N; when allowHalf, clicking the LEFT half of a
  // star sets N-0.5. If allowClear and the clicked value equals the current one, it
  // clears to 0 instead (toggle-off).
  _valueAt(starIndex, e) {
    // starIndex is 1-based. Default to the whole star.
    let v = starIndex;
    if (this.allowHalf) {
      const star = e.currentTarget;
      const rect = star.getBoundingClientRect();
      const isLeftHalf = rect.width > 0 && (e.clientX - rect.left) < rect.width / 2;
      if (isLeftHalf) v = starIndex - 0.5;
    }
    return v;
  }

  _onStarClick(starIndex, e) {
    if (this.disabled || this.readonly) return;
    const v = this._valueAt(starIndex, e);
    if (this.allowClear && v === Number(this.value)) { this._set(0); return; }
    this._set(v);
  }

  _onStarMove(starIndex, e) {
    if (this.disabled || this.readonly) return;
    const v = this._valueAt(starIndex, e);
    // Hover is visual-only — it must NOT change value or any aria-* state. We nudge a
    // re-render (requestUpdate) so the stars preview `_hover`; render() leaves the
    // slider's aria-valuenow / aria-valuetext bound to the real value.
    if (v !== this._hover) { this._hover = v; this.requestUpdate(); }
  }

  _onLeave() {
    if (this._hover !== 0) { this._hover = 0; this.requestUpdate(); }
  }

  render() {
    const count = Number(this.count) || 5;
    const value = Number(this.value) || 0;
    const disabled = !!this.disabled;
    // The visual fill follows the hover preview when hovering, else the real value.
    const shown = this._hover > 0 ? this._hover : value;
    const stars = [];
    for (let i = 1; i <= count; i++) {
      // Fill fraction for star i: 1 (full), 0.5 (half), or 0 (empty).
      const fill = shown >= i ? 1 : shown >= i - 0.5 ? 0.5 : 0;
      const fillCls = fill === 1 ? " puredashboard-rate__star--full" : fill === 0.5 ? " puredashboard-rate__star--half" : "";
      stars.push(html`<span
        class="puredashboard-rate__star js-puredashboard-rate__star${fillCls}"
        data-index="${i}"
        title="${this._label("star", i)}"
        @click="${(e) => this._onStarClick(i, e)}"
        @mousemove="${(e) => this._onStarMove(i, e)}"
      ><span class="puredashboard-rate__empty">${starGlyph}</span><span class="puredashboard-rate__filled">${starGlyph}</span></span>`);
    }
    return html`
      <div class="puredashboard-rate__slider js-puredashboard-rate__slider" role="slider" tabindex="${disabled ? "-1" : "0"}" aria-label="${this.getAttribute("aria-label") ?? this._label("ariaLabel")}" aria-valuemin="0" aria-valuemax="${count}" aria-valuenow="${value}" aria-valuetext="${this._label("valueText", value, count)}" aria-disabled="${disabled ? "true" : "false"}" aria-readonly="${this.readonly ? "true" : "false"}" @keydown="${(e) => this._onKey(e)}" @mouseleave="${() => this._onLeave()}">${stars}</div>`;
  }
}
PuredashboardRate.define("puredashboard-rate");

export { PuredashboardRate };
