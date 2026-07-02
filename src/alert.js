// <puredashboard-alert> — an inline alert / notice banner.
// Zero-dep, no build, CSP-safe. Built on the Reactive base.
//
// A STATIC, in-flow message box (contrast with toast.js, the transient top-layer
// sibling): it announces something in place — a form-level error, a success
// confirmation, a warning or an informational note — and optionally lets the user
// dismiss it. Four semantic types drive the colour, the leading glyph, and the ARIA
// live-region politeness (errors/warnings are assertive `role="alert"`, info/success
// are polite `role="status"`). All fixed strings live in a LABELS map, overridable
// via the `labels` property; `title` and `message` are author CONTENT (escaped via
// the reactive html`` interpolation, never raw()). Theme through the shared design
// tokens (--danger-bg/--success-bg/--warning-bg/--info-bg, --red/--green/--amber/
// --accent, --text, --radius, …) with a --pd-* fallback chain so it works with no
// theme linked. See docs/DEVELOPMENT.md → "Definition of Done".
import { Reactive, html } from "./reactive.js";
import { raw } from "./html.js";

// All user-facing (chrome) strings live here (English defaults). Override any subset
// via the `labels` property to localise — e.g. al.labels = { close: "Bỏ qua" }.
// NOTE: `title`/`message` are author content, NOT labels.
const LABELS = {
  close: "Dismiss",       // aria-label on the close button
};

// Local inline-SVG helper (per component; no shared icon module). `raw()` marks the
// TRUSTED, hard-coded glyph markup as safe — this is never used for author content.
const svg = (b) => raw(`<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-.14em;overflow:visible;flex:none" aria-hidden="true">${b}</svg>`);

// Per-type config: the leading glyph and the ARIA live-region role (assertive vs
// polite). Colour is handled entirely in alert.css via the BEM modifier class.
const TYPES = {
  info:    { role: "status", icon: svg('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>') },
  success: { role: "status", icon: svg('<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>') },
  warning: { role: "alert",  icon: svg('<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>') },
  error:   { role: "alert",  icon: svg('<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>') },
};
// "danger" is an accepted alias for "error".
const ALIAS = { danger: "error" };
const normType = (t) => (ALIAS[t] || (TYPES[t] ? t : "info"));

/**
 * An inline alert / notice banner: a static, in-flow message box that announces a
 * form-level error, a success confirmation, a warning, or an informational note, and
 * can optionally be dismissed. The `type` selects the colour, the leading glyph, and
 * the ARIA live-region politeness — `error`/`warning` render `role="alert"`
 * (assertive), `info`/`success` render `role="status"` (polite). Configure via JS
 * properties or HTML attributes.
 *
 * @element puredashboard-alert
 *
 * @prop {string}  type     - `"info"` (default) | `"success"` | `"warning"` | `"error"` (`"danger"` is an alias for `"error"`). Unknown values fall back to `"info"`.
 * @prop {string}  title    - Optional bold heading (author content, escaped). Default `""`.
 * @prop {string}  message  - Body text (author content, escaped). Default `""`.
 * @prop {boolean} closable - Render a close button that dismisses the banner. Default `false`.
 * @prop {boolean} showIcon - Show the per-type leading glyph. Default `true`.
 * @prop {Object}  labels   - Override UI strings. Keys: `close` (the close button's aria-label). Unset keys keep the English default.
 *
 * @fires close - Bubbling, cancelable `CustomEvent` fired when the close button is pressed. Call `event.preventDefault()` to keep the element mounted; otherwise it removes itself.
 *
 * @cssprop [--pd-alert-bg]     - Soft tinted background (defaults per type to `--info-bg`/`--success-bg`/`--warning-bg`/`--danger-bg`).
 * @cssprop [--pd-alert-accent] - Hue for the icon + border (defaults per type to `--accent`/`--green`/`--amber`/`--red`).
 *
 * @example
 * const al = document.createElement("puredashboard-alert");
 * al.type = "error"; al.title = "Save failed"; al.message = "Check your connection.";
 * al.closable = true;
 * al.addEventListener("close", (e) => { if (!confirm("Dismiss?")) e.preventDefault(); });
 * document.body.append(al);
 */
class PuredashboardAlert extends Reactive {
  static properties = {
    type: {}, title: {}, message: {}, closable: {}, showIcon: {}, labels: {},
  };

  // Reflect declarative HTML attributes into reactive properties, so the banner can be
  // authored the natural way — <puredashboard-alert type="error" closable>. Boolean
  // attrs map by presence.
  static observedAttributes = ["type", "title", "message", "closable", "show-icon"];
  attributeChangedCallback(name, _old, val) {
    if (name === "closable") { this.closable = val !== null; return; }
    if (name === "show-icon") { this.showIcon = val !== null; return; }
    this[name] = val;
  }

  // _label(key, …args) → localised string: this.labels override, else the default.
  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  setup() {
    if (this.showIcon == null) this.showIcon = true;
    if (this.type == null) this.type = "info";
  }

  // The close button emits a bubbling, cancelable "close" event; unless a listener
  // calls preventDefault(), the banner removes itself from the DOM.
  _close() {
    const ev = new CustomEvent("close", { bubbles: true, cancelable: true });
    const kept = !this.dispatchEvent(ev);   // dispatchEvent → false when default prevented
    if (!kept) this.remove();
  }

  render() {
    const type = normType(this.type);
    const cfg = TYPES[type];
    const showIcon = this.showIcon !== false;
    return html`
      <div class="puredashboard-alert__box puredashboard-alert__box--${type}" role="${cfg.role}">
        ${showIcon ? html`<span class="puredashboard-alert__icon">${cfg.icon}</span>` : ""}
        <div class="puredashboard-alert__body">
          ${this.title ? html`<div class="puredashboard-alert__title">${this.title}</div>` : ""}
          ${this.message ? html`<div class="puredashboard-alert__message">${this.message}</div>` : ""}
        </div>
        ${this.closable ? html`<button class="puredashboard-alert__close js-puredashboard-alert__close" type="button" aria-label="${this._label("close")}" @click="${() => this._close()}">${raw('<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;overflow:visible" aria-hidden="true"><path d="m18 6-12 12"/><path d="m6 6 12 12"/></svg>')}</button>` : ""}
      </div>`;
  }
}
PuredashboardAlert.define("puredashboard-alert");

export { PuredashboardAlert };
