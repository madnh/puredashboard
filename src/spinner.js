// <puredashboard-spinner> — a loading indicator (spinning ring).
// Zero-dep, no build, CSP-safe. Built on the Reactive base.
//
// A pure feedback element: it shows an animated ring while something is in flight
// and announces itself to assistive tech. Because its whole render is an
// html`…` template (a decorative ring + an optional label), it extends Reactive
// — there is no author light-DOM content to preserve (unlike <puredashboard-tag>
// / <puredashboard-badge>, which wrap children and so stay on plain HTMLElement).
//
// a11y: the host is role="status" + aria-live="polite", so a screen reader
// announces it when it appears/updates. The accessible name is either the VISIBLE
// label (referenced via aria-labelledby when `labelVisible`) or an aria-label
// (when the text is sr-only). The animated ring itself is aria-hidden — it's
// decoration, the status role + name carry the meaning.
//
// Follows the input-family conventions: fixed strings in a LABELS map + a `labels`
// override, BEM classes namespaced by the tag, script hooks as SEPARATE js-…
// classes, and theming through the shared --pd-* token chain (--accent for the
// spinning segment, --border/--panel-3 for the track, --muted for the label) so
// it works with no theme linked. The spin animation is disabled under
// prefers-reduced-motion via a @media rule in spinner.css.
import { Reactive, html } from "./reactive.js";

// All FIXED user-facing strings live here (English defaults). Override any subset
// via the `labels` property — e.g. sp.labels = { loading: "Đang tải" }. This is
// the DEFAULT accessible name (aria-label) when no explicit `label` is set.
// Function-valued keys interpolate.
const LABELS = {
  loading: "Loading",
};

// Named sizes → BEM modifier. Anything else (a bare number / CSS length) is
// treated as an explicit diameter written to --pd-spinner-size instead.
const SIZES = new Set(["sm", "md", "lg"]);

let uid = 0;

/**
 * A loading indicator: an animated spinning ring with an accessible status role.
 * The ring is decorative (`aria-hidden`); the host is `role="status"` +
 * `aria-live="polite"` so assistive tech announces it, named by the visible label
 * (when `labelVisible`) or an `aria-label`. Configure via JS properties or
 * declarative attributes. The spin is paused under `prefers-reduced-motion`.
 *
 * @element puredashboard-spinner
 *
 * @prop {string}  size         - `"sm"` | `"md"` | `"lg"`, OR a number / CSS length used as the ring diameter (via `--pd-spinner-size`). Default `"md"`.
 * @prop {string}  label        - Accessible label / visible text. Default `LABELS.loading` (`"Loading"`).
 * @prop {boolean} labelVisible - Show the label text beside the ring (otherwise it is sr-only and used as the `aria-label`). Default `false`.
 * @prop {boolean} inline       - `inline-flex` beside surrounding content instead of a block that centres itself. Default `false`.
 * @prop {Object}  labels       - Override UI strings. Keys: `loading`. Unset keys keep the English default.
 *
 * @attr {string}  size          - Declarative form of `size` (`sm`/`md`/`lg` or a length).
 * @attr {string}  label         - Declarative form of `label`.
 * @attr {boolean} label-visible - Declarative form of `labelVisible`.
 * @attr {boolean} inline        - Declarative form of `inline`.
 *
 * @cssprop [--pd-spinner-size]  - Ring diameter (set automatically from a numeric `size`; defaults per named size).
 * @cssprop [--pd-spinner-track] - Track (ring background) colour (defaults to `--border` / `--panel-3`).
 * @cssprop [--pd-spinner-color] - Spinning segment colour (defaults to `--accent`).
 *
 * @example
 * // <puredashboard-spinner label-visible label="Saving…"></puredashboard-spinner>
 * const sp = document.createElement("puredashboard-spinner");
 * sp.size = "lg"; sp.inline = true;
 * document.body.append(sp);
 */
class PuredashboardSpinner extends Reactive {
  static properties = {
    size: {}, label: {}, labelVisible: {}, inline: {}, labels: {},
  };

  constructor() {
    super();
    this._labelId = `js-puredashboard-spinner__label-${++uid}`;
  }

  // Reflect declarative HTML attributes into reactive properties so the spinner
  // can be configured the natural way — <puredashboard-spinner size="lg" inline>.
  // Boolean attrs map by presence.
  static observedAttributes = ["size", "label", "label-visible", "inline"];
  attributeChangedCallback(name, _old, val) {
    if (name === "label-visible") this.labelVisible = val !== null;
    else if (name === "inline") this.inline = val !== null;
    else this[name] = val;
  }

  // _label(key, …args) → localised string: this.labels override, else the default.
  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  // The accessible name / visible text: an explicit `label`, else the localised
  // default. Never empty, so role="status" always has a name.
  get _text() { return this.label != null && this.label !== "" ? this.label : this._label("loading"); }

  // Keep the host's a11y wiring in sync after every render. role/aria-live are set
  // on the host (not a child) so the whole element is the live region. The name is
  // aria-labelledby the visible label, or an aria-label when the text is sr-only.
  updated() {
    this.setAttribute("role", "status");
    this.setAttribute("aria-live", "polite");
    const text = this._text;
    if (this.labelVisible) {
      this.setAttribute("aria-labelledby", this._labelId);
      this.removeAttribute("aria-label");
    } else {
      this.setAttribute("aria-label", text);
      this.removeAttribute("aria-labelledby");
    }
  }

  render() {
    const size = this.size;
    // Named size → modifier class; any other truthy value → explicit diameter.
    const named = SIZES.has(size);
    const sizeCls = named && size !== "md" ? ` puredashboard-spinner__ring--${size}` : "";
    // A bare number becomes px; a CSS length (e.g. "3rem") is used as-is.
    const custom = size && !named ? (/^\d+$/.test(String(size)) ? `${size}px` : String(size)) : "";
    const ringStyle = custom ? `--pd-spinner-size:${custom}` : "";
    const text = this._text;
    // The label text always renders (so aria-labelledby resolves); it's visually
    // hidden via a modifier class when not labelVisible. The ring is decoration.
    const labelCls = this.labelVisible ? "puredashboard-spinner__label" : "puredashboard-spinner__label puredashboard-spinner__label--sr";
    this.classList.toggle("puredashboard-spinner--inline", !!this.inline);
    return html`<span class="puredashboard-spinner__ring${sizeCls}" style="${ringStyle}" aria-hidden="true"></span><span class="${labelCls}" id="${this._labelId}">${text}</span>`;
  }
}
PuredashboardSpinner.define("puredashboard-spinner");

export { PuredashboardSpinner };
