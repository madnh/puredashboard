// <puredashboard-card> — a content CONTAINER/panel that wraps its light-DOM
// children into a titled, bordered surface. Zero-dep, no build, CSP-safe.
// Extends plain HTMLElement (NOT Reactive) — a Reactive render() would blow away
// the author's light-DOM children, and this component's whole job is to PRESERVE
// those children while wrapping them in structure (like <puredashboard-form>).
//
// Why it exists: dashboards are grids of panels — a bordered surface with an
// optional title, an optional actions region (buttons, menus) in the header, a
// body, and an optional footer. Rather than make every page hand-roll that
// markup, this element takes the children the author already wrote and, on
// connect, MOVES them (never clones, never serializes) into a `.__body`, then
// builds the surrounding header/footer around them. Author-supplied title/footer/
// extra text is CONTENT (properties/attributes and child nodes), not localisable
// UI chrome, so it is NOT in LABELS — LABELS holds only fixed strings the
// component itself emits (e.g. a fallback aria-label on the region).
//
// Footer/extra PROJECTION: a child tagged `data-card-footer` (or `slot="footer"`)
// is routed into the footer region instead of the body; a child tagged
// `data-card-extra` (or `slot="extra"`) is routed into the header extra region.
// This is a light-DOM stand-in for named slots — done by MOVING the real nodes,
// so listeners and live state on them are preserved.
//
// It is deliberately not form-associated and not interactive: it is a container.

// All FIXED user-facing strings live here (English defaults). Override any subset
// via the `labels` property — e.g. card.labels = { region: "Bảng" }. Function-
// valued keys interpolate. The author's title/footer text is CONTENT, not here.
const LABELS = {
  region: "Panel",
};

/**
 * A content CONTAINER that wraps its light-DOM children into a bordered panel
 * with an optional header (title + an "extra" actions region) and an optional
 * footer. It extends plain `HTMLElement` (not `Reactive`) so the children the
 * author writes are PRESERVED: on connect they are MOVED — not cloned, not
 * serialized — into a `.puredashboard-card__body`, and the header/footer are
 * built around them. Live nodes, listeners and any nested custom elements
 * therefore survive intact.
 *
 * Project a child into the footer by marking it `data-card-footer` (or
 * `slot="footer"`); project a child into the header's actions region by marking
 * it `data-card-extra` (or `slot="extra"`). Everything else becomes the body.
 * Configure via JS properties or declarative attributes.
 *
 * @element puredashboard-card
 *
 * @prop {string}  title    - Header title text (get/set). Setting it after connect updates the rendered title, creating the header if needed. Default `""`.
 * @prop {boolean} bordered - Draw the panel border/background. Default `true`.
 * @prop {Object}  labels   - Override UI strings. Keys: `region`. Unset keys keep the English default.
 * @attr {string}  title    - Declarative form of `title`.
 * @attr {boolean} bordered - Declarative form of `bordered` (presence). Absent attribute keeps the default `true`; use `bordered="false"` to turn it off.
 *
 * @cssprop [--pd-card-pad]    - Padding inside header/body/footer (defaults to `--sp-4`).
 * @cssprop [--pd-card-radius] - Corner radius (defaults to `--radius`).
 *
 * @example
 * // <puredashboard-card title="Revenue">
 * //   <button data-card-extra>Export</button>
 * //   <p>Body content…</p>
 * //   <div data-card-footer>Updated just now</div>
 * // </puredashboard-card>
 * const card = document.createElement("puredashboard-card");
 * card.title = "Revenue";
 * card.append(someBodyNode);
 * container.append(card);
 */
class PuredashboardCard extends HTMLElement {
  static get observedAttributes() { return ["title", "bordered"]; }

  constructor() {
    super();
    this._wrapped = false;
    this._header = null;   // .puredashboard-card__header (created lazily)
    this._titleEl = null;  // .puredashboard-card__title
    this._extra = null;    // .puredashboard-card__extra
    this._body = null;     // .puredashboard-card__body
    this._footer = null;   // .puredashboard-card__footer
    // A template engine may set these as plain own-properties BEFORE upgrade,
    // shadowing the accessors; reconcile them through the setters on upgrade.
    this._upgrade("title");
    this._upgrade("bordered");
    this._upgrade("labels");
  }

  _upgrade(p) {
    if (Object.prototype.hasOwnProperty.call(this, p)) { const v = this[p]; delete this[p]; this[p] = v; }
  }

  // _label(key, …args) → localised string: this.labels override, else the default.
  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  // ---- title (reflected to the header after connect) ------------------------
  get title() { return this._title ?? ""; }
  set title(v) {
    this._title = v == null ? "" : String(v);
    if (this._wrapped) this._reflectTitle();
  }

  // ---- bordered (default true) ---------------------------------------------
  get bordered() { return this._bordered !== false; }
  set bordered(v) {
    this._bordered = v !== false && v !== "false" && v != null ? true : (v === false || v === "false" ? false : true);
    if (this._wrapped) this._reflectBordered();
  }

  attributeChangedCallback(name, _old, val) {
    if (name === "title") this.title = val ?? "";
    else if (name === "bordered") this.bordered = val === null ? true : val;
  }

  connectedCallback() {
    this._wrap();
  }

  // Build the panel structure ONCE by MOVING the author's current children into a
  // body, then routing any projected children (footer/extra) to their regions.
  // Guarded so it runs exactly once even across disconnect/reconnect — moving
  // children again would re-wrap the wrapper.
  _wrap() {
    if (this._wrapped) return;
    this._wrapped = true;

    // Snapshot the author's original children BEFORE we create any wrappers, so
    // the wrappers themselves are never treated as content to re-project.
    const originals = Array.from(this.childNodes);

    const body = document.createElement("div");
    body.className = "puredashboard-card__body js-puredashboard-card__body";
    this._body = body;

    // Partition the originals: projected footer/extra go to their regions, the
    // rest (in order) go to the body. We MOVE the nodes (appendChild moves an
    // already-parented node) so live state and listeners are preserved.
    for (const node of originals) {
      const target = this._projectionTarget(node);
      if (target === "footer") this._footerRegion().appendChild(node);
      else if (target === "extra") this._extraRegion().appendChild(node);
      else body.appendChild(node);
    }

    // Assemble in visual order: header (if any) → body → footer (if any). The
    // header is created lazily by title/extra; create it now if a title is set.
    if (this._title) this._reflectTitle();
    if (this._header) this.appendChild(this._header);
    this.appendChild(body);
    if (this._footer) this.appendChild(this._footer);

    this.setAttribute("role", "group");
    if (!this.hasAttribute("aria-label") && !this._title) this.setAttribute("aria-label", this._label("region"));
    this._reflectBordered();
  }

  // Which region does an author child belong to? Only ELEMENT nodes can carry the
  // markers; text/comment nodes always fall through to the body.
  _projectionTarget(node) {
    if (node.nodeType !== 1) return "body";
    if (node.hasAttribute("data-card-footer") || node.getAttribute("slot") === "footer") return "footer";
    if (node.hasAttribute("data-card-extra") || node.getAttribute("slot") === "extra") return "extra";
    return "body";
  }

  // ---- lazy region builders -------------------------------------------------
  // The header hosts the title + the extra actions region. Created on first need.
  _headerRegion() {
    if (this._header) return this._header;
    const header = document.createElement("div");
    header.className = "puredashboard-card__header";
    this._header = header;
    // If we're already assembled, insert the header before the body so order holds.
    if (this._wrapped && this._body && this._body.parentNode === this) {
      this.insertBefore(header, this._body);
    }
    return header;
  }

  _titleNode() {
    if (this._titleEl) return this._titleEl;
    const t = document.createElement("div");
    t.className = "puredashboard-card__title";
    this._titleEl = t;
    // Title goes first inside the header, before any extra region.
    const header = this._headerRegion();
    if (this._extra && this._extra.parentNode === header) header.insertBefore(t, this._extra);
    else header.appendChild(t);
    return t;
  }

  _extraRegion() {
    if (this._extra) return this._extra;
    const e = document.createElement("div");
    e.className = "puredashboard-card__extra";
    this._extra = e;
    this._headerRegion().appendChild(e); // extra sits after the title
    return e;
  }

  _footerRegion() {
    if (this._footer) return this._footer;
    const f = document.createElement("div");
    f.className = "puredashboard-card__footer";
    this._footer = f;
    // If assembled, footer belongs at the end (after the body).
    if (this._wrapped && this._body && this._body.parentNode === this) this.appendChild(f);
    return f;
  }

  // Push the current title into the header, creating the header/title node if a
  // non-empty title arrives; textContent-only (title is plain text CONTENT).
  _reflectTitle() {
    const text = this._title ?? "";
    if (!text) {
      if (this._titleEl) this._titleEl.textContent = "";
      return;
    }
    this._titleNode().textContent = text; // textContent → no HTML-injection surface
    // A titled card carries its own accessible name; drop the fallback aria-label.
    if (this.getAttribute("aria-label") === this._label("region")) this.removeAttribute("aria-label");
  }

  // Toggle the border/background modifier. Driven by a data-* state hook so the
  // BEM class the CSS keys off is never something the script also selects by.
  _reflectBordered() {
    if (this.bordered) this.removeAttribute("data-card-flat");
    else this.setAttribute("data-card-flat", "");
  }
}

customElements.define("puredashboard-card", PuredashboardCard);

export { PuredashboardCard };
