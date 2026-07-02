// <puredashboard-result> — a full result / status page (like Antd Result): a
// large status icon, a title, a muted subtitle, and an actions region holding
// author-provided buttons. Zero-dep, no build, CSP-safe.
//
// Extends plain HTMLElement (NOT Reactive) — a Reactive render() would blow away
// the author's light-DOM children, and part of this component's job is to
// PRESERVE those children (the action buttons) while wrapping them. It uses the
// same wrap-once pattern as empty.js / form.js: on connect it MOVES any existing
// children into a `.puredashboard-result__extra` region, then builds the icon +
// title + subtitle ABOVE that region. The wrap is idempotent (guarded), so a
// disconnect/reconnect never re-wraps or duplicates nodes.
//
// Follows the library conventions: fixed strings in a LABELS map + a `labels`
// override, BEM classes namespaced by the tag, script hooks as SEPARATE js-…
// classes, and theming through the shared design tokens (--green/--red/--amber/
// --accent for status, --text, --muted, --sp-*, --font-size-*) via a --pd-*
// fallback chain so it works with no theme linked. `title`/`subtitle` are
// CONTENT (properties/attrs) reflected via textContent — never innerHTML — while
// the status glyphs are TRUSTED inline svg() markup emitted via raw().
import { raw } from "./html.js";

// Tiny local SVG helper (self-contained icons — no shared icon module), sized in
// `em` via an inline style and overflow:visible so strokes near the viewBox edge
// aren't clipped by the UA default. Returns a trusted-markup string.
const svg = (b) => raw(`<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-.14em;overflow:visible" aria-hidden="true">${b}</svg>`);

// Per-status inline glyphs (all trusted, built-in). success → check-in-circle,
// error → cross-in-circle, warning → warning triangle, info → info circle. The
// numeric statuses (404/403/500) render the big number as text instead of an
// SVG (see ICONS + _buildIcon), matching Antd's server-status pages.
const ICONS = {
  success: svg('<circle cx="12" cy="12" r="10"/><path d="m8 12 2.5 2.5L16 9"/>'),
  error:   svg('<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>'),
  warning: svg('<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>'),
  info:    svg('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'),
};

// The numeric server statuses render the code itself as the "glyph".
const NUMERIC = { "404": "404", "403": "403", "500": "500" };

const STATUSES = ["success", "error", "info", "warning", "404", "403", "500"];
const DEFAULT_STATUS = "info";

// All FIXED user-facing strings live here (English defaults). Override any subset
// via the `labels` property to localise — e.g. el.labels = { "404": "Không tìm thấy" }.
// Each key is the DEFAULT title fallback for a status, shown only when the caller
// sets no `title` property/attribute (which is treated as content).
const LABELS = {
  success: "Success",
  error: "Error",
  info: "Info",
  warning: "Warning",
  "404": "404",
  "403": "403",
  "500": "500",
};

/**
 * A full result / status page: a large per-status icon, a title, a muted
 * subtitle, and an `.puredashboard-result__extra` region holding author-provided
 * action buttons. Extends plain `HTMLElement` (NOT `Reactive`) so it can PRESERVE
 * the author's light-DOM children: on connect it moves any existing children into
 * the extra region and builds the icon + title + subtitle above them. The wrap
 * runs exactly once (idempotent across disconnect/reconnect).
 *
 * Place your call-to-action controls as ordinary children; they are moved into
 * the extra region, in order, without being destroyed. Configure the rest via JS
 * properties or declarative attributes.
 *
 * @element puredashboard-result
 *
 * @prop {string} status   - One of `"success"`, `"error"`, `"info"`, `"warning"`, `"404"`, `"403"`, `"500"`. Default `"info"`. Selects the glyph and status modifier class; reflected on change. Unknown values fall back to the default.
 * @prop {string} title    - The (bold) title line. This is CONTENT and wins over `labels[status]`. Falls back to the status label when unset. Reflected to `.puredashboard-result__title` via textContent on change.
 * @prop {string} subtitle - The (muted) subtitle line. CONTENT; the subtitle node is hidden when empty. Reflected to `.puredashboard-result__subtitle` via textContent on change.
 * @prop {Object} labels   - Override UI strings. Keys: one per status (`success`/`error`/`info`/`warning`/`404`/`403`/`500`) — each the fallback title when no `title` content is set. Unset keys keep the English default.
 * @attr {string} status   - Declarative form of the `status` property.
 * @attr {string} title    - Declarative form of the `title` property.
 * @attr {string} subtitle - Declarative form of the `subtitle` property.
 *
 * @cssprop [--pd-result-icon-size]  - Icon size (defaults to `72px`; the numeric statuses scale it up).
 * @cssprop [--pd-result-gap]        - Vertical gap between icon, title, subtitle and extra (defaults to `--sp-3`).
 * @cssprop [--pd-result-icon-color] - Icon colour (defaults per status to `--green`/`--red`/`--amber`/`--accent`).
 *
 * @example
 * // <puredashboard-result status="success" title="Payment done" subtitle="Order #1234 confirmed.">
 * //   <button type="button">Go to dashboard</button>
 * // </puredashboard-result>
 * const res = document.createElement("puredashboard-result");
 * res.status = "404";
 * res.title = "Page not found";
 * res.subtitle = "The page you visited does not exist.";
 * container.append(res);
 */
class PuredashboardResult extends HTMLElement {
  static get observedAttributes() { return ["status", "title", "subtitle"]; }

  constructor() {
    super();
    this._wrapped = false;
    this._iconEl = null;
    this._titleEl = null;
    this._subtitleEl = null;
    this._status = undefined;
    this._title = undefined;
    this._subtitle = undefined;
    // A template engine may set properties before the element upgrades, leaving
    // plain own-properties that shadow the accessors. Reconcile them (parity with
    // the rest of the library).
    this._upgrade("status");
    this._upgrade("title");
    this._upgrade("subtitle");
    this._upgrade("labels");
  }

  _upgrade(p) {
    if (Object.prototype.hasOwnProperty.call(this, p)) { const v = this[p]; delete this[p]; this[p] = v; }
  }

  attributeChangedCallback(name, _old, val) {
    // All three observed attributes are content: mirror the attribute into the
    // property, whose setter reflects into the built DOM.
    if (name === "status") this.status = val;
    else if (name === "title") this.title = val;
    else if (name === "subtitle") this.subtitle = val;
  }

  // _label(key, …args) → localised string: this.labels override, else the default.
  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  // The effective status — the set value if valid, else the default.
  _status_() { return STATUSES.includes(this._status) ? this._status : DEFAULT_STATUS; }

  // ---- status (content property; selects the glyph + modifier class) ----------
  get status() { return this._status_(); }
  set status(v) {
    this._status = v == null ? undefined : String(v);
    this._reflectStatus();
  }

  // ---- title (content, wins over the label fallback) --------------------------
  get title() { return this._title; }
  set title(v) {
    this._title = v == null ? undefined : String(v);
    this._reflectTitle();
  }

  // ---- subtitle (content; hidden when empty) ----------------------------------
  get subtitle() { return this._subtitle; }
  set subtitle(v) {
    this._subtitle = v == null ? undefined : String(v);
    this._reflectSubtitle();
  }

  connectedCallback() { this._wrap(); }

  // Build the icon + title + subtitle ABOVE an extra region that holds the
  // author's original children. Guarded so it runs exactly once — moving children
  // again would re-wrap the wrapper and duplicate the glyph/title.
  _wrap() {
    if (this._wrapped) return;
    this._wrapped = true;

    // 1. Extra region — MOVE (not clone) the author's current children into it,
    //    order preserved, so live nodes and listeners survive.
    const extra = document.createElement("div");
    extra.className = "puredashboard-result__extra js-puredashboard-result__extra";
    while (this.firstChild) extra.appendChild(this.firstChild);

    // 2. Status icon. aria-hidden: decorative; the title carries the meaning.
    const icon = document.createElement("div");
    icon.className = "puredashboard-result__icon";
    icon.setAttribute("aria-hidden", "true");
    this._iconEl = icon;

    // 3. Title (bold) + subtitle (muted).
    const title = document.createElement("div");
    title.className = "puredashboard-result__title";
    this._titleEl = title;

    const subtitle = document.createElement("div");
    subtitle.className = "puredashboard-result__subtitle";
    this._subtitleEl = subtitle;

    // Fill from current state now that the nodes exist.
    this._reflectStatus();
    this._reflectTitle();
    this._reflectSubtitle();

    // Assemble: icon, title, subtitle, then the (possibly empty) extra region.
    this.appendChild(icon);
    this.appendChild(title);
    this.appendChild(subtitle);
    this.appendChild(extra);
  }

  // Set the status modifier attribute (for CSS) + build the glyph. The numeric
  // server statuses render the code as text; the rest render a trusted SVG.
  _reflectStatus() {
    const status = this._status_();
    // Reflect onto a data-* hook (script/style selector — never a BEM class the
    // author might style directly), so the CSS can colour per status.
    this.setAttribute("data-status", status);
    this._reflectTitle();     // title fallback depends on the status label
    if (!this._iconEl) return;
    if (NUMERIC[status] != null) {
      this._iconEl.classList.add("puredashboard-result__icon--numeric");
      this._iconEl.textContent = NUMERIC[status];   // trusted text
    } else {
      this._iconEl.classList.remove("puredashboard-result__icon--numeric");
      this._iconEl.innerHTML = String(ICONS[status]);   // trusted built-in glyph
    }
  }

  // Push the current title into the title node (once wrapped). Untrusted content
  // only ever reaches the DOM via textContent — never innerHTML.
  _reflectTitle() {
    if (!this._titleEl) return;
    this._titleEl.textContent = this._title != null ? this._title : this._label(this._status_());
  }

  // Subtitle is optional content; hide the node when there's nothing to show.
  _reflectSubtitle() {
    if (!this._subtitleEl) return;
    const has = this._subtitle != null && this._subtitle !== "";
    this._subtitleEl.textContent = has ? this._subtitle : "";
    this._subtitleEl.hidden = !has;
  }
}

customElements.define("puredashboard-result", PuredashboardResult);

export { PuredashboardResult };
