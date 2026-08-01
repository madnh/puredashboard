// <puredashboard-divider> — a thin separator between content, optionally labelled.
// Zero-dep, no build, CSP-safe. Extends plain HTMLElement (NOT Reactive) — a
// Reactive render() would blow away the author's light-DOM children, and a
// labelled divider's whole point is to PRESERVE the author's text as the label.
//
// Two shapes, one element:
//   • PLAIN rule — no text: a semantic separator. role="separator" +
//     aria-orientation ("horizontal" default | "vertical"). This is the ARIA
//     separator: a divider between sections that carries no content of its own.
//   • LABELLED — author children or a `text` property: a line—text—line layout
//     (horizontal only). Because the text IS content in the accessibility tree,
//     the host is NOT role=separator (a separator has no accessible name/content);
//     it stays a generic grouping so the label is announced as ordinary text.
//     `textAlign` shifts the label left / center (default) / right.
//
// Follows the library conventions: fixed strings in a LABELS map + a `labels`
// override, BEM classes namespaced by the tag, script hooks as SEPARATE js-…
// classes, and theming through the shared design tokens (--border, --muted,
// --text, --sp-*, --font-size-sm) via a --pd-* fallback chain so it works with
// no theme linked. It builds NO markup from untrusted strings: author text stays
// in its original nodes, and the `text` property is written via textContent only.

// All FIXED user-facing strings live here (English defaults). Override any subset
// via the `labels` property — e.g. div.labels = { separator: "Phân cách" }.
// Function-valued keys interpolate. The label a plain rule exposes to assistive
// tech (via aria-label) so a bare separator isn't wholly anonymous.
const LABELS = {
  separator: "Separator",
};

/**
 * A thin separator between blocks of content, optionally carrying a centred (or
 * left/right-aligned) label. Extends plain `HTMLElement` so any author text
 * children are PRESERVED as the label rather than destroyed by a render pass.
 *
 * With no text it is a semantic ARIA `separator` (a plain rule); with text —
 * author children or the `text` property — it becomes a labelled, heading-like
 * separator whose label stays in the accessibility tree (so it is intentionally
 * NOT `role=separator`, since a separator carries no content). Configure via JS
 * properties or declarative attributes.
 *
 * @element puredashboard-divider
 *
 * @prop {string}  orientation - `"horizontal"` (default) | `"vertical"`. Vertical is an inline rule; text is ignored when vertical.
 * @prop {boolean} dashed      - Render the line dashed instead of solid. Default `false`.
 * @prop {string}  textAlign   - `"center"` (default) | `"left"` | `"right"`. Shifts the label; only affects a horizontal divider WITH text.
 * @prop {string}  text        - Convenience label used when there are NO author children. Set via `textContent` (never `innerHTML`). Default `""`.
 * @prop {Object}  labels      - Override UI strings. Keys: `separator`. Unset keys keep the English default.
 * @attr {string}  orientation - Declarative form of `orientation`.
 * @attr {boolean} dashed      - Declarative form of `dashed`.
 * @attr {string}  text-align  - Declarative form of `textAlign`.
 * @attr {string}  text        - Declarative form of `text` (used only when there are no author children).
 * @attr {string}  aria-label - Accessible name, applied to the element that carries the component's role (the host has no role of its own). Overrides the built-in `LABELS` name.
 *
 * @cssprop [--pd-divider-color]   - Line colour (defaults to `--border`).
 * @cssprop [--pd-divider-spacing] - Block/inline margin around the divider (defaults to `--sp-4`).
 *
 * @example
 * // Plain rule between two sections:
 * // <puredashboard-divider></puredashboard-divider>
 * @example
 * // Labelled, left-aligned:
 * // <puredashboard-divider text-align="left">Section</puredashboard-divider>
 * @example
 * // Vertical inline separator:
 * // <span>A</span><puredashboard-divider orientation="vertical"></puredashboard-divider><span>B</span>
 */
class PuredashboardDivider extends HTMLElement {
  static get observedAttributes() { return ["orientation", "dashed", "text-align", "text"]; }

  constructor() {
    super();
    this._built = false;
    this._label = null; // the wrapper that holds the author's label nodes (if any)
    // A template engine may set these before upgrade, leaving plain own-props that
    // shadow the accessors below; reconcile for parity with the rest of the library.
    for (const p of ["orientation", "dashed", "textAlign", "text", "labels"]) this._upgrade(p);
  }

  _upgrade(p) {
    if (Object.prototype.hasOwnProperty.call(this, p)) { const v = this[p]; delete this[p]; this[p] = v; }
  }

  // ---- reflected properties -------------------------------------------------
  get orientation() { return this.getAttribute("orientation") === "vertical" ? "vertical" : "horizontal"; }
  set orientation(v) { if (v == null) this.removeAttribute("orientation"); else this.setAttribute("orientation", v); }

  get dashed() { return this.hasAttribute("dashed"); }
  set dashed(v) { if (v) this.setAttribute("dashed", ""); else this.removeAttribute("dashed"); }

  get textAlign() { const v = this.getAttribute("text-align"); return v === "left" || v === "right" ? v : "center"; }
  set textAlign(v) { if (v == null) this.removeAttribute("text-align"); else this.setAttribute("text-align", v); }

  get text() { return this.getAttribute("text") ?? ""; }
  set text(v) { if (v == null || v === "") this.removeAttribute("text"); else this.setAttribute("text", v); }

  attributeChangedCallback() { if (this._built) this._build(); }

  // _t(key, …args) → localised string: this.labels override, else the default.
  _t(key, ...a) { const v = (this.labels && this.labels[key]) ?? LABELS[key]; return typeof v === "function" ? v(...a) : v; }

  connectedCallback() {
    // Capture the author's label nodes ONCE, before we (re)build, so repeated
    // rebuilds (attribute flips) don't lose them. Author children win over `text`.
    if (this._label == null) {
      const nodes = [];
      while (this.firstChild) nodes.push(this.removeChild(this.firstChild));
      const hasText = nodes.some((n) => n.textContent && n.textContent.trim() !== "");
      if (hasText) {
        const wrap = document.createElement("span");
        wrap.className = "puredashboard-divider__text js-puredashboard-divider__text";
        for (const n of nodes) wrap.appendChild(n);
        this._label = wrap;
      }
    }
    this._build();
  }

  // Rebuild the internal structure to match the current props. Idempotent: it
  // clears and re-lays-out, but the author's label wrapper (this._label) is a
  // stable node that is re-attached, never recreated — so its nodes survive.
  _build() {
    this._built = true;
    const vertical = this.orientation === "vertical";

    // Resolve the label: author children take precedence; else fall back to
    // `text` (written via textContent — NEVER innerHTML — so it stays XSS-safe).
    // Text is meaningful only for a horizontal divider.
    let label = null;
    if (!vertical) {
      if (this._label) {
        label = this._label;
      } else if (this.text) {
        const wrap = this._textNode || document.createElement("span");
        this._textNode = wrap;
        wrap.className = "puredashboard-divider__text js-puredashboard-divider__text";
        wrap.textContent = this.text;
        label = wrap;
      }
    }

    // Remove any structure from a previous build (but keep label nodes alive).
    while (this.firstChild) this.removeChild(this.firstChild);

    this.classList.toggle("puredashboard-divider--vertical", vertical);
    this.classList.toggle("puredashboard-divider--horizontal", !vertical);
    this.classList.toggle("puredashboard-divider--dashed", this.dashed);
    this.classList.toggle("puredashboard-divider--with-text", !!label);
    this.classList.remove(
      "puredashboard-divider--align-left",
      "puredashboard-divider--align-center",
      "puredashboard-divider--align-right",
    );

    if (label) {
      // Labelled: line — text — line. The host is a group (NOT a separator),
      // because the label is real content in the a11y tree.
      this.classList.add(`puredashboard-divider--align-${this.textAlign}`);
      this.removeAttribute("role");
      this.removeAttribute("aria-orientation");
      // Only OUR label is dropped — an aria-label set by the author stays (button.js rule).
      if (this.getAttribute("aria-label") === this._ariaOwn) { this.removeAttribute("aria-label"); this._ariaOwn = null; }

      const before = document.createElement("span");
      before.className = "puredashboard-divider__line puredashboard-divider__line--before";
      before.setAttribute("aria-hidden", "true");
      const after = document.createElement("span");
      after.className = "puredashboard-divider__line puredashboard-divider__line--after";
      after.setAttribute("aria-hidden", "true");

      this.appendChild(before);
      this.appendChild(label);
      this.appendChild(after);
    } else {
      // Plain rule: a semantic separator with an orientation the AT can announce.
      this.setAttribute("role", "separator");
      this.setAttribute("aria-orientation", vertical ? "vertical" : "horizontal");
      // Default name only when the author didn't name the separator themselves.
      if (!this.hasAttribute("aria-label") || this.getAttribute("aria-label") === this._ariaOwn) {
        this._ariaOwn = this._t("separator");
        this.setAttribute("aria-label", this._ariaOwn);
      }
    }
  }
}

customElements.define("puredashboard-divider", PuredashboardDivider);

export { PuredashboardDivider };
