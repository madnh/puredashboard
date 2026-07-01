// <puredashboard-empty> — an empty-state placeholder (centered illustration +
// description + optional action area). Zero-dep, no build, CSP-safe.
//
// Extends plain HTMLElement (NOT Reactive) — a Reactive render() would blow away
// the author's light-DOM children, and this component's whole job is to PRESERVE
// those children (the action buttons) while wrapping them. It uses the same
// wrap-once pattern as form.js: on connect it MOVES any existing children into a
// `.puredashboard-empty__actions` region, then builds the illustration + the
// description line ABOVE that region. The wrap is idempotent (guarded), so a
// disconnect/reconnect never re-wraps or duplicates nodes.
//
// Follows the library conventions: fixed strings in a LABELS map + a `labels`
// override (LABELS.description is the DEFAULT text — a caller-set `description`
// is CONTENT, a property that wins over the label), BEM classes namespaced by the
// tag, script hooks as SEPARATE js-… classes / data-* attrs, and theming through
// the shared design tokens (--muted, --faint, --text, --sp-*, --font-size-*) via
// a --pd-* fallback chain so it works with no theme linked.
import { raw } from "./html.js";

// Tiny local SVG helper (self-contained icon — no shared icon module), sized in
// `em` via an inline style and overflow:visible so strokes near the viewBox edge
// aren't clipped by the UA default. Returns a trusted-markup string.
const svg = (b) => raw(`<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-.14em;overflow:visible" aria-hidden="true">${b}</svg>`);

// The default empty-state glyph: an open document/inbox tray. Overridable by
// setting the `icon` property to your own SVG markup string or a DOM node.
const DEFAULT_ICON = svg('<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>');

// All FIXED user-facing strings live here (English defaults). Override any subset
// via the `labels` property to localise — e.g. el.labels = { description: "Không có dữ liệu" }.
// `description` here is only the FALLBACK shown when the caller sets no `description`
// property/attribute (which is treated as content).
const LABELS = {
  description: "No data",
};

/**
 * An empty-state placeholder: a centered illustration, a description line, and an
 * optional action area holding author-provided buttons. Extends plain
 * `HTMLElement` (NOT `Reactive`) so it can PRESERVE the author's light-DOM
 * children: on connect it moves any existing children into
 * `.puredashboard-empty__actions` and builds the illustration + description above
 * them. The wrap runs exactly once (idempotent across disconnect/reconnect).
 *
 * Place your call-to-action controls as ordinary children; they are moved into
 * the actions region, in order, without being destroyed. Configure the rest via
 * JS properties or declarative attributes.
 *
 * @element puredashboard-empty
 *
 * @prop {string}  description - The description line. This is CONTENT and wins over `labels.description`. Default falls back to `LABELS.description` (`"No data"`). Reflected to the `.puredashboard-empty__desc` node on change.
 * @prop {boolean} compact     - Tighter, smaller layout (smaller icon + spacing). Default `false`.
 * @prop {(string|Node)} icon  - Override the default illustration: an SVG markup string (trusted) or a DOM node. Unset → the built-in glyph.
 * @prop {Object}  labels      - Override UI strings. Keys: `description` (the fallback when no `description` content is set). Unset keys keep the English default.
 * @attr {string}  description - Declarative form of the `description` property.
 * @attr {boolean} compact     - Declarative form of the `compact` property.
 *
 * @cssprop [--pd-empty-icon-size]      - Illustration size (defaults to `48px`, `32px` when compact).
 * @cssprop [--pd-empty-gap]            - Vertical gap between icon, description and actions (defaults to `--sp-3`).
 * @cssprop [--pd-empty-desc-color]     - Description text colour (defaults to `--muted`).
 * @cssprop [--pd-empty-icon-color]     - Illustration colour (defaults to `--faint`).
 *
 * @example
 * // <puredashboard-empty description="No projects yet">
 * //   <button type="button">Create project</button>
 * // </puredashboard-empty>
 * const empty = document.createElement("puredashboard-empty");
 * empty.description = "No results";
 * container.append(empty);
 */
class PuredashboardEmpty extends HTMLElement {
  // Only `description` is content that must mirror attribute→property; `compact`
  // is a style hook read directly off the attribute by its accessor, so it needs
  // no observation (and observing it would risk an attribute↔setter loop).
  static get observedAttributes() { return ["description"]; }

  constructor() {
    super();
    this._wrapped = false;
    this._descEl = null;
    // A template engine may set properties before the element upgrades, leaving
    // plain own-properties that shadow the accessors. Reconcile them (parity with
    // the rest of the library).
    this._upgrade("description");
    this._upgrade("compact");
    this._upgrade("icon");
    this._upgrade("labels");
  }

  _upgrade(p) {
    if (Object.prototype.hasOwnProperty.call(this, p)) { const v = this[p]; delete this[p]; this[p] = v; }
  }

  attributeChangedCallback(name, _old, val) {
    // `description` is content: mirror the attribute into the property (which
    // reflects to the desc node). `compact` is a pure style hook stored ON the
    // attribute itself, so its accessor reads/writes the attribute directly — we
    // must NOT re-assign it here or we'd loop attribute→setter→attribute.
    if (name === "description") this.description = val;
  }

  // _label(key, …args) → localised string: this.labels override, else the default.
  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  // ---- description (content property, wins over the label fallback) ----------
  get description() { return this._description; }
  set description(v) {
    this._description = v == null ? undefined : String(v);
    this._reflectDesc();
  }

  get compact() { return this.hasAttribute("compact"); }
  set compact(v) {
    if (v) this.setAttribute("compact", "");
    else this.removeAttribute("compact");
  }

  connectedCallback() { this._wrap(); }

  // Build the illustration + description ABOVE an actions region that holds the
  // author's original children. Guarded so it runs exactly once — moving children
  // again would re-wrap the wrapper and duplicate the icon/description.
  _wrap() {
    if (this._wrapped) return;
    this._wrapped = true;

    // 1. Actions region — MOVE (not clone) the author's current children into it,
    //    order preserved, so live nodes and listeners survive. Re-reading
    //    firstChild each loop handles the live NodeList as we append.
    const actions = document.createElement("div");
    actions.className = "puredashboard-empty__actions js-puredashboard-empty__actions";
    while (this.firstChild) actions.appendChild(this.firstChild);

    // 2. Illustration — the caller's icon (string markup or DOM node) or the
    //    built-in glyph. aria-hidden: it's decorative; the description carries the
    //    meaning.
    const icon = document.createElement("div");
    icon.className = "puredashboard-empty__icon";
    icon.setAttribute("aria-hidden", "true");
    if (this.icon instanceof Node) icon.appendChild(this.icon);
    else if (typeof this.icon === "string") icon.innerHTML = this.icon;          // trusted author markup
    else icon.innerHTML = String(DEFAULT_ICON);                                  // trusted built-in glyph

    // 3. Description line.
    const desc = document.createElement("div");
    desc.className = "puredashboard-empty__desc";
    this._descEl = desc;
    this._reflectDesc();

    // Assemble: icon, description, then the (possibly empty) actions region.
    this.appendChild(icon);
    this.appendChild(desc);
    this.appendChild(actions);
  }

  // Push the current description text into the desc node (once wrapped). Untrusted
  // text only ever reaches the DOM via textContent — never innerHTML.
  _reflectDesc() {
    if (!this._descEl) return;
    this._descEl.textContent = this._description != null ? this._description : this._label("description");
  }
}

customElements.define("puredashboard-empty", PuredashboardEmpty);

export { PuredashboardEmpty };
