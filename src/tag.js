// <puredashboard-tag> — an inline label / chip. Zero-dep, no build, CSP-safe.
//
// Extends plain HTMLElement (NOT Reactive) on purpose: the tag's TEXT is author
// CONTENT supplied as light-DOM children — <puredashboard-tag>Online</…> — and a
// Reactive render() would blow those children away on every render. So this
// component never rewrites its children; it only (a) mirrors its declarative
// attributes (color/size/closable/round) onto BEM modifier classes, and (b) when
// `closable`, APPENDS a single close <button> AFTER the author's text (append
// only, never clobber). Same conventions as the rest of the library: fixed
// strings in a LABELS map + a `labels` override, BEM classes namespaced by the
// tag, script hooks as SEPARATE js-… classes, and theming through the shared
// design tokens (--panel-2/3, --border, --text, --muted, the status hues and
// their soft backgrounds) via a --pd-* fallback chain so it works with no theme.

// All FIXED user-facing strings live here (English defaults). Override any subset
// via the `labels` property — e.g. tag.labels = { remove: "Xóa" }. Function-valued
// keys interpolate. The tag's visible text is author content, not a label.
const LABELS = {
  remove: "Remove",
};

// The color variants we accept; anything else falls back to "default".
const COLORS = ["default", "accent", "success", "warning", "danger", "info", "neutral"];

/**
 * An inline label / chip. The tag's visible text is AUTHOR CONTENT written as
 * children — `<puredashboard-tag color="success">Online</puredashboard-tag>` —
 * which the component preserves untouched. Configure the look via attributes or
 * the matching JS properties. When `closable`, a trailing close button is added;
 * clicking it emits a cancelable `close` event and, unless prevented, removes the
 * tag from the DOM.
 *
 * @element puredashboard-tag
 *
 * @prop {string}  color    - `default` | `accent` | `success` | `warning` | `danger` | `info` | `neutral`. Sets a BEM modifier + color tokens. Default `"default"`.
 * @prop {string}  size     - `"sm"` | `"md"`. Default `"md"`.
 * @prop {boolean} closable - Render a trailing close button. Default `false`.
 * @prop {boolean} round    - Pill shape (via `--radius-full`). Default `false`.
 * @prop {Object}  labels   - Override UI strings. Keys: `remove` (close-button aria-label). Unset keys keep the English default.
 * @attr {string}  color    - Declarative form of `color`.
 * @attr {string}  size     - Declarative form of `size`.
 * @attr {boolean} closable - Declarative form of `closable`.
 * @attr {boolean} round    - Declarative form of `round`.
 *
 * @fires close - `CustomEvent` (bubbles, cancelable) when the close button is clicked. Call `preventDefault()` to keep the tag; otherwise the element removes itself.
 *
 * @cssprop [--pd-tag-bg]     - Background fill (per-color).
 * @cssprop [--pd-tag-fg]     - Text color (per-color).
 * @cssprop [--pd-tag-border] - Border color (per-color).
 *
 * @example
 * // <puredashboard-tag color="success" closable round>Online</puredashboard-tag>
 * const tag = document.querySelector("puredashboard-tag");
 * tag.addEventListener("close", (e) => { if (isPinned) e.preventDefault(); });
 */
class PuredashboardTag extends HTMLElement {
  static get observedAttributes() { return ["color", "size", "closable", "round"]; }

  constructor() {
    super();
    this._closeBtn = null;
    // A template engine may set a property before upgrade, leaving a plain
    // own-property shadowing the accessor; reconcile for parity with the family.
    this._upgrade("labels");
  }

  _upgrade(p) {
    if (Object.prototype.hasOwnProperty.call(this, p)) { const v = this[p]; delete this[p]; this[p] = v; }
  }

  // ---- attribute ⇄ property mirroring ---------------------------------------
  // Boolean props map by attribute presence; string props by value.
  get color() { return this.getAttribute("color") || "default"; }
  set color(v) { if (v == null) this.removeAttribute("color"); else this.setAttribute("color", v); }
  get size() { return this.getAttribute("size") || "md"; }
  set size(v) { if (v == null) this.removeAttribute("size"); else this.setAttribute("size", v); }
  get closable() { return this.hasAttribute("closable"); }
  set closable(v) { if (v) this.setAttribute("closable", ""); else this.removeAttribute("closable"); }
  get round() { return this.hasAttribute("round"); }
  set round(v) { if (v) this.setAttribute("round", ""); else this.removeAttribute("round"); }

  attributeChangedCallback() {
    // Any observed attribute change → re-derive modifiers + close button. Cheap
    // and idempotent, and only runs once the element is connected/upgraded.
    if (this.isConnected) this._reflect();
  }

  // _label(key, …args) → localised string: this.labels override, else the default.
  _label(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  connectedCallback() {
    this._reflect();
  }

  // Derive BEM modifier classes from the current attrs and add/remove the close
  // button. Never touches the author's text children — the close button is a
  // dedicated node we own (tracked via this._closeBtn) and only ever append.
  _reflect() {
    const color = COLORS.includes(this.color) ? this.color : "default";
    const size = this.size === "sm" ? "sm" : "md";

    // Base + modifiers. Rebuild only the classes WE control, preserving any
    // author-added classes.
    this.classList.add("puredashboard-tag");
    for (const c of COLORS) this.classList.toggle(`puredashboard-tag--${c}`, c === color);
    this.classList.toggle("puredashboard-tag--sm", size === "sm");
    this.classList.toggle("puredashboard-tag--round", this.round);
    this.classList.toggle("puredashboard-tag--closable", this.closable);

    if (this.closable) this._ensureCloseButton();
    else this._removeCloseButton();
  }

  // Append (once) a close button AFTER the author's text. Guarded so repeated
  // reflects don't create duplicates.
  _ensureCloseButton() {
    if (this._closeBtn && this._closeBtn.isConnected) {
      this._closeBtn.setAttribute("aria-label", this._label("remove"));
      return;
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "puredashboard-tag__close js-puredashboard-tag__close";
    btn.setAttribute("aria-label", this._label("remove"));
    btn.innerHTML = svg();                       // trusted, static SVG markup only
    btn.addEventListener("click", this._onClose);
    this.appendChild(btn);                       // append only — author text stays first
    this._closeBtn = btn;
  }

  _removeCloseButton() {
    if (this._closeBtn) {
      this._closeBtn.removeEventListener("click", this._onClose);
      this._closeBtn.remove();
      this._closeBtn = null;
    }
  }

  // Emit a cancelable "close" from the host. If a consumer calls preventDefault(),
  // the tag stays; otherwise it removes itself from the DOM.
  _onClose = (e) => {
    e.stopPropagation();                         // the button's own click, not a bubbled one
    const ev = new CustomEvent("close", { bubbles: true, cancelable: true, detail: {} });
    const proceed = this.dispatchEvent(ev);      // false ⇢ someone called preventDefault()
    if (proceed) this.remove();
  };
}

// Inline "×" close icon. Kept dependency-free and local (each component inlines
// its own SVG — no shared icon module). Static, trusted markup → innerHTML is safe.
function svg() {
  return '<svg class="puredashboard-tag__icon" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M4 4l8 8M12 4l-8 8"/></svg>';
}

customElements.define("puredashboard-tag", PuredashboardTag);

export { PuredashboardTag };
